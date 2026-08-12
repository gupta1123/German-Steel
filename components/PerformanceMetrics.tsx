import { Card, CardContent } from "@/components/ui/card";

interface PerformanceMetricsProps {
  visitDuration: string;
  intentLevel: string;
  monthlySales: string;  // Add monthly sales prop
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ visitDuration, intentLevel, monthlySales }) => {
  return (
    <Card className="shadow-lg">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-blue-100 rounded-lg p-4">
            <p className="text-sm text-blue-500 font-medium">Visit Duration</p>
            <p className="text-2xl font-bold text-blue-800">{visitDuration}</p>
          </div>

          <div className="bg-purple-100 rounded-lg p-4">
            <p className="text-sm text-purple-500 font-medium">Intent Level</p>
            <p className="text-2xl font-bold text-purple-800">{intentLevel}</p>
          </div>

          <div className="bg-green-100 rounded-lg p-4">
            <p className="text-sm text-green-500 font-medium">Monthly Sales</p>
            <p className="text-2xl font-bold text-green-800">{monthlySales}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceMetrics;
