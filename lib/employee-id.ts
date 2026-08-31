export interface EmployeeIdRecord { employeeId?: string | number | null }

export function employeeIdExists(records: EmployeeIdRecord[], candidate: string): boolean {
  const key = candidate.trim().toUpperCase();
  return records.some(record => String(record.employeeId ?? '').trim().toUpperCase() === key);
}

/** Continue the most common business-ID series; never use database/user IDs. */
export function suggestEmployeeId(records: EmployeeIdRecord[]): string {
  const ids = [...new Set(records.map(record => String(record.employeeId ?? '').trim().toUpperCase()).filter(Boolean))];
  const series = new Map<string, { count: number; highest: bigint; width: number }>();
  for (const id of ids) {
    const match = /^(.*?)(\d+)$/.exec(id);
    if (!match) continue;
    const [, prefix, digits] = match;
    const number = BigInt(digits);
    const current = series.get(prefix);
    series.set(prefix, {
      count: (current?.count ?? 0) + 1,
      highest: current && current.highest > number ? current.highest : number,
      width: Math.max(current?.width ?? 0, digits.length),
    });
  }
  const chosen = [...series].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0];
  if (!chosen) return 'EMP-001';
  const [prefix, { highest, width }] = chosen;
  return prefix + (highest + BigInt(1)).toString().padStart(width, '0');
}
