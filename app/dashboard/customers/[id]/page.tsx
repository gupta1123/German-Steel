import CustomerDetailPage from "@/components/customer-detail-page";

export default async function CustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // In a real app, you would fetch customer data based on the ID
  // For now, we'll use mock data
  const { id } = await params;

  const customerData = {
    id: Number(id),
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    company: "Acme Corporation",
    position: "CEO",
    address: "123 Business Ave, New York, NY 10001",
    status: "Active",
    lastContact: "2023-06-15",
    createdAt: "2022-01-15",
    avatar: "/placeholder.svg?height=100&width=100",
  };

  return <CustomerDetailPage customer={customerData} />;
}
