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
  CardContent,
  CardFooter,
  CardHeader,
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

interface ModernLeaveApprovalCardProps {
  request: LeaveRequest;
  onStatusChange: (id: number, status: string, type?: "full" | "half") => void;
}

export default function ModernLeaveApprovalCard({ 
  request, 
  onStatusChange 
}: ModernLeaveApprovalCardProps) {
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
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  const getTypeDisplay = (type: "full" | "half", label: string) => {
    return type === "full" ? (
      <div className="flex items-center">
        <Sun className="mr-2 h-4 w-4 text-orange-500" />
        <span>{label}</span>
      </div>
    ) : (
      <div className="flex items-center">
        <SunDim className="mr-2 h-4 w-4 text-yellow-500" />
        <span>{label}</span>
      </div>
    );
  };

  const getTypeSelect = () => {
    return (
      <Select value={editedType} onValueChange={(value: "full" | "half") => setEditedType(value)}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full">
            <div className="flex items-center">
              <Sun className="mr-2 h-4 w-4 text-orange-500" />
              Full Day
            </div>
          </SelectItem>
          <SelectItem value="half">
            <div className="flex items-center">
              <SunDim className="mr-2 h-4 w-4 text-yellow-500" />
              Half Day
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  };

  return (
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="bg-muted p-2 rounded-lg">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">{request.executiveName}</h3>
              <p className="text-sm text-muted-foreground">
                Submitted {format(new Date(request.submittedAt), "MMM d, yyyy h:mm a")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                {request.reason && (
                  <DropdownMenuItem onClick={() => setIsViewingReason(true)}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    View Reason
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {format(new Date(request.date), "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">Leave Date</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted p-2 rounded-lg">
                <Sun className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {getTypeDisplay(request.requestedType, "")}
                </div>
                <div className="text-xs text-muted-foreground">Requested</div>
              </div>
            </div>
            
            {request.status !== "pending" ? (
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg">
                  {request.status === "approved" ? 
                    <CheckCircle className="h-4 w-4 text-green-500" /> : 
                    <XCircle className="h-4 w-4 text-red-500" />
                  }
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {getTypeDisplay(request.approvedType, "")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {request.status === "approved" ? "Approved" : "Not Approved"}
                  </div>
                </div>
              </div>
            ) : isEditing ? (
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg">
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  {getTypeSelect()}
                  <div className="text-xs text-muted-foreground mt-1">Approve as</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded-lg">
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">
                    {getTypeDisplay(request.approvedType, "")}
                  </div>
                  <div className="text-xs text-muted-foreground">Will Approve As</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        {request.status === "pending" ? (
          <>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleReject}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={handleApprove}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleReject}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={() => setIsEditing(true)}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit & Approve
                </Button>
              </>
            )}
          </>
        ) : (
          <Button variant="outline" onClick={() => setIsEditing(true)} className="ml-auto">
            <Edit3 className="mr-2 h-4 w-4" />
            Change Status
          </Button>
        )}
      </CardFooter>
      
      <Dialog open={isViewingReason} onOpenChange={setIsViewingReason}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Reason</DialogTitle>
            <DialogDescription>
              Reason provided by {request.executiveName} for their leave request
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">{request.reason}</p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}