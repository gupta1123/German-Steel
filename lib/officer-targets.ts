import type { EmployeeUserDto, SalesTargetDto } from "./api";

export type TargetRecipientType = "field_officer" | "manager";

const normalizedTargetRole = (role: string | null | undefined) =>
  role?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/^role /, "").replace(/\s+/g, " ") ?? "";

export const isTargetFieldOfficer = (employee: Pick<EmployeeUserDto, "role">) => {
  const role = normalizedTargetRole(employee.role);
  // Every field executive role (RETAIL_FE, EMPANELMENT_FE, PROJECT_FE, RETAIL_EMPANELMENT_FE, RETAIL_PROJECT_FE, INSTITUTION_PROJECT_FE, DUAL_FE).
  return Boolean(role?.includes("field officer") || role?.endsWith(" fe"));
};

export const isTargetManager = (employee: Pick<EmployeeUserDto, "role">) => [
  "manager",
  "regional manager",
  "office manager",
  "zonal supervisor",
].includes(normalizedTargetRole(employee.role));

export const getTargetRecipientType = (
  employee: Pick<EmployeeUserDto, "role">,
): TargetRecipientType | null => {
  if (isTargetManager(employee)) return "manager";
  if (isTargetFieldOfficer(employee)) return "field_officer";
  return null;
};

export const targetRecipientTypeLabel = (type: TargetRecipientType) =>
  type === "manager" ? "Manager" : "Field officer";

export const targetAchieved = (target: SalesTargetDto) =>
  Number(target.effectiveFulfilledTons ?? target.fulfilledTons ?? target.salesTons ?? 0) || 0;

export function summarizeTargets(targets: SalesTargetDto[]) {
  const target = targets.reduce((total, item) => total + Number(item.targetTons || 0), 0);
  const achieved = targets.reduce((total, item) => total + targetAchieved(item), 0);
  // An overachieved store must not erase another store's outstanding allocation.
  const remaining = targets.reduce((total, item) => total + Math.max(0, Number(item.targetTons || 0) - targetAchieved(item)), 0);
  return { target, achieved, remaining, percent: target > 0 ? achieved / target * 100 : 0 };
}

export function groupOfficerTargets(employees: EmployeeUserDto[], targets: SalesTargetDto[]) {
  const directory = new Map(employees.map((employee) => [Number(employee.id), employee]));
  const groups = new Map<number, { id: number; name: string; code: string; targets: SalesTargetDto[] }>();
  for (const employee of employees.filter(isTargetFieldOfficer)) {
    groups.set(Number(employee.id), {
      id: Number(employee.id),
      name: [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() || "Unnamed field officer",
      code: String(employee.employeeId || ""),
      targets: [],
    });
  }
  for (const target of targets) {
    const id = Number(target.employeeId);
    const employee = directory.get(id);
    if (employee && !isTargetFieldOfficer(employee)) continue;
    // Keep returned allocations visible if the employee directory is incomplete.
    if (!groups.has(id)) groups.set(id, { id, name: target.employeeName || "Unnamed field officer", code: "", targets: [] });
    groups.get(id)!.targets.push(target);
  }
  return Array.from(groups.values()).map((officer) => ({
    ...officer,
    storeCount: new Set(officer.targets.map((target) => target.storeId)).size,
    ...summarizeTargets(officer.targets),
  })).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
