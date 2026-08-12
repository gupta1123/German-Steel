import EmployeeFormWizard from "@/components/employee-form-wizard";

interface EditEmployeePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const { id } = await params;
  const numericId = Number(id);
  const employeeId = Number.isNaN(numericId) ? undefined : numericId;

  return <EmployeeFormWizard mode="edit" employeeId={employeeId} />;
}
