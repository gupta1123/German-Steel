import CustomerDetailPage from "@/components/customer-detail-page";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetailPage accountId={Number(id)} />;
}
