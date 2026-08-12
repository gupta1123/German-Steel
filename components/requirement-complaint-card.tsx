import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MoreHorizontal, 
  Calendar, 
  User, 
  Building, 
  Flag,
  Edit,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ItemData {
  id: number;
  title: string;
  description: string;
  storeName: string;
  assignedTo: string;
  status: string;
  createdDate: string;
  priority: "low" | "medium" | "high";
  type: "requirement" | "complaint";
}

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

interface PriorityOption {
  value: "low" | "medium" | "high";
  label: string;
  color: string;
}

const statusOptions: Record<string, StatusOption[]> = {
  requirement: [
    { value: "new", label: "New", color: "bg-blue-100 text-blue-800" },
    { value: "in-progress", label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
    { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
    { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
  ],
  complaint: [
    { value: "open", label: "Open", color: "bg-red-100 text-red-800" },
    { value: "in-progress", label: "In Progress", color: "bg-yellow-100 text-yellow-800" },
    { value: "resolved", label: "Resolved", color: "bg-green-100 text-green-800" },
    { value: "closed", label: "Closed", color: "bg-gray-100 text-gray-800" },
  ]
};

const priorityOptions: PriorityOption[] = [
  { value: "low", label: "Low", color: "bg-green-100 text-green-800" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { value: "high", label: "High", color: "bg-red-100 text-red-800" },
];

interface RequirementComplaintCardProps {
  item: ItemData;
  onStatusChange?: (id: number, newStatus: string) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
}

export default function RequirementComplaintCard({ 
  item, 
  onStatusChange,
  onEdit,
  onDelete 
}: RequirementComplaintCardProps) {
  const [status, setStatus] = useState(item.status);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    onStatusChange?.(item.id, newStatus);
  };

  const getPriorityOption = (priorityValue: "low" | "medium" | "high") => {
    return priorityOptions.find(option => option.value === priorityValue) || priorityOptions[0];
  };

  const currentPriority = getPriorityOption(item.priority);

  return (
    <div className="border rounded-lg p-4 hover:shadow-sm transition-shadow bg-card">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm truncate" title={item.title}>
            {item.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={item.description}>
            {item.description}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge 
            className={cn("text-xs px-1.5 py-0.5", currentPriority.color)}
            title={currentPriority.label}
          >
            <Flag className="h-2.5 w-2.5 mr-1" />
            {currentPriority.label}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onEdit?.(item.id)} className="text-xs">
                <Edit className="mr-2 h-3 w-3" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(item.id)} className="text-xs">
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 truncate">
          <Building className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate" title={item.storeName}>{item.storeName}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate" title={item.assignedTo}>{item.assignedTo}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate" title={format(new Date(item.createdDate), "MMM d, yyyy")}>
            {format(new Date(item.createdDate), "MMM d, yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-6 text-xs py-0 px-1.5 truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions[item.type].map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  <span className={cn("px-1.5 py-0.5 rounded-full text-xs", option.color)}>
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}