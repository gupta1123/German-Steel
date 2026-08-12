import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar,
  Sun,
  SunDim,
  Edit3,
  MoreVertical,
  MessageCircle
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Card,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LeaveRequest {
  id: number;
  executiveName: string;
  date: string;
  requestedType: "full" | "half";
  approvedType: "full" | "half";
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reason?: string;
}

interface CompactLeaveApprovalCardProps {
  request: LeaveRequest;
  onStatusChange: (id: number, status: string, type?: "full" | "half") => void;
}

export default function CompactLeaveApprovalCard({ 
  request, 
  onStatusChange 
}: CompactLeaveApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedType, setEditedType] = useState<"full" | "half">(request.approvedType);
  const [isViewingReason, setIsViewingReason] = useState(false);

  const handleApprove = () => {
    onStatusChange(request.id, "approved", editedType);
    setIsEditing(false);
  };

  const handleReject = () => {
    onStatusChange(request.id, "rejected");
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    onStatusChange(request.id, request.status, editedType);
    setIsEditing(false);
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs py-0.5"><CheckCircle className="mr-1 h-2.5 w-2.5" />Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs py-0.5"><XCircle className="mr-1 h-2.5 w-2.5" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs py-0.5"><Clock className="mr-1 h-2.5 w-2.5" />Pending</Badge>;
    }
  };

  const getTypeDisplay = (type: "full" | "half", label: string) => {
    return type === "full" ? (
      <div className="flex items-center text-xs">
        <Sun className="mr-1 h-3 w-3 text-orange-500" />
        <span>{label || "Full Day"}</span>
      </div>
    ) : (
      <div className="flex items-center text-xs">
        <SunDim className="mr-1 h-3 w-3 text-yellow-500" />
        <span>{label || "Half Day"}</span>
      </div>
    );
  };

  const getTypeSelect = () => {
    return (
      <Select value={editedType} onValueChange={(value: "full" | "half") => setEditedType(value)}>
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full">
            <div className="flex items-center">
              <Sun className="mr-1 h-3 w-3 text-orange-500" />
              Full Day
            </div>
          </SelectItem>
          <SelectItem value="half">
            <div className="flex items-center">
              <SunDim className="mr-1 h-3 w-3 text-yellow-500" />
              Half Day
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  };

  return (
    <Card className="w-full hover:shadow-sm transition-shadow">
      <div className="p-3">
        {/* Header row with employee info and status */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-muted p-1.5 rounded-md">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-sm truncate">{request.executiveName}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {format(new Date(request.submittedAt), "MMM d, h:mm a")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {getStatusBadge()}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setIsEditing(true)} className="text-xs">
                  <Edit3 className="mr-2 h-3.5 w-3.5" />
                  Edit & Approve
                </DropdownMenuItem>
                {request.reason && (
                  <DropdownMenuItem onClick={() => setIsViewingReason(true)} className="text-xs">
                    <MessageCircle className="mr-2 h-3.5 w-3.5" />
                    View Reason
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main content row */}
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {format(new Date(request.date), "MMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">Date</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className="bg-muted p-1 rounded">
              <Sun className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xs font-medium">
                {getTypeDisplay(request.requestedType, "")}
              </div>
              <div className="text-xs text-muted-foreground">Requested</div>
            </div>
          </div>
          
          {request.status !== "pending" ? (
            <div className="flex items-center gap-1.5">
              <div className="bg-muted p-1 rounded">
                {request.status === "approved" ? 
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : 
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                }
              </div>
              <div>
                <div className="text-xs font-medium">
                  {getTypeDisplay(request.approvedType, "")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {request.status === "approved" ? "Approved" : "Rejected"}
                </div>
              </div>
            </div>
          ) : isEditing ? (
            <div className="flex items-center gap-1.5">
              <div className="bg-muted p-1 rounded">
                <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                {getTypeSelect()}
                <div className="text-xs text-muted-foreground">Approve as</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="bg-muted p-1 rounded">
                <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-xs font-medium">
                  {getTypeDisplay(request.approvedType, "")}
                </div>
                <div className="text-xs text-muted-foreground">Will Approve As</div>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {request.status === "pending" ? (
          <div className="flex justify-end gap-1.5">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(false)}
                  className="h-7 text-xs px-2"
                >
                  Cancel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReject}
                  className="h-7 text-xs px-2"
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Reject
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleApprove}
                  className="h-7 text-xs px-2"
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Approve
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReject}
                  className="h-7 text-xs px-2"
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Reject
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => setIsEditing(true)}
                  className="h-7 text-xs px-2"
                >
                  <Edit3 className="mr-1 h-3 w-3" />
                  Edit & Approve
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              className="h-7 text-xs px-2"
            >
              <Edit3 className="mr-1 h-3 w-3" />
              Change Status
            </Button>
          </div>
        )}
      </div>
      
      <Dialog open={isViewingReason} onOpenChange={setIsViewingReason}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Leave Reason</DialogTitle>
            <DialogDescription>
              Reason provided by {request.executiveName} for their leave request
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm">{request.reason}</p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}