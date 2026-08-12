import { Card, CardContent } from "@/components/ui/card";
import { MapPin, User } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  lastUpdated: string;
  status: string;
  location: string;
  totalVisits?: number;
}

interface EmployeeCardProps {
  employee: Employee;
  onClick: () => void;
}

export default function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="bg-gray-200 border-2 border-dashed rounded-xl w-10 h-10" />
          <div>
            <h3 className="font-semibold">{employee.name}</h3>
            <p className="text-sm text-muted-foreground">{employee.position}</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{employee.location}</span>
          </div>
          {employee.totalVisits !== undefined && (
            <div className="flex items-center gap-1 text-sm">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                Visits: {employee.totalVisits}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}