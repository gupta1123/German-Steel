import VisitDetailPage from "@/components/visit-detail-page";
import { API } from "@/lib/api";

export default async function VisitDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Just await params to satisfy Next.js 15 requirements
  await params;

  // The VisitDetailPage component gets the visitId from route params using useParams()
  return <VisitDetailPage />;
}

function calculateDuration(startTime: string, endTime: string): string {
  try {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  } catch {
    return "N/A";
  }
}
