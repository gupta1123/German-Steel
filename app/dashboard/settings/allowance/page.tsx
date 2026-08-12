"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { DollarSign, Plus, Edit, Save, X } from "lucide-react";

type Employee = {
  id: number;
  name: string;
  role: string;
  da: number;
  salary: number;
  carRatePerKm: number;
  bikeRatePerKm: number;
  status: string;
};

// Mock data
const mockEmployees: Employee[] = [
  {
    id: 1,
    name: "Alice Smith",
    role: "Field Officer",
    da: 1500,
    salary: 25000,
    carRatePerKm: 12,
    bikeRatePerKm: 8,
    status: "active"
  },
  {
    id: 2,
    name: "Bob Johnson",
    role: "Sales Manager",
    da: 2000,
    salary: 45000,
    carRatePerKm: 15,
    bikeRatePerKm: 10,
    status: "active"
  },
  {
    id: 3,
    name: "Charlie Brown",
    role: "Field Officer",
    da: 1500,
    salary: 25000,
    carRatePerKm: 12,
    bikeRatePerKm: 8,
    status: "active"
  },
  {
    id: 4,
    name: "Diana Prince",
    role: "Regional Manager",
    da: 2500,
    salary: 60000,
    carRatePerKm: 18,
    bikeRatePerKm: 12,
    status: "active"
  }
];

export default function AllowanceSettings() {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [tempEmployeeData, setTempEmployeeData] = useState<Employee | null>(null);
  const [isAddAllowanceOpen, setIsAddAllowanceOpen] = useState(false);
  const [newAllowance, setNewAllowance] = useState({
    name: "",
    type: "",
    amount: "",
    applicableTo: ""
  });

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setTempEmployeeData({...employee});
  };

  const handleSaveEmployee = () => {
    setEmployees(employees.map(emp => 
      emp.id === editingEmployeeId && tempEmployeeData ? tempEmployeeData : emp
    ));
    setEditingEmployeeId(null);
    setTempEmployeeData(null);
  };

  const handleCancelEdit = () => {
    setEditingEmployeeId(null);
    setTempEmployeeData(null);
  };

  const handleAddAllowance = () => {
    if (newAllowance.name && newAllowance.type && newAllowance.amount) {
      // In a real app, this would make an API call to add the allowance
      console.log("Adding new allowance:", newAllowance);
      setIsAddAllowanceOpen(false);
      setNewAllowance({
        name: "",
        type: "",
        amount: "",
        applicableTo: ""
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">

        <Dialog open={isAddAllowanceOpen} onOpenChange={setIsAddAllowanceOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Allowance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Allowance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Allowance Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Travel Allowance"
                  value={newAllowance.name}
                  onChange={(e) => setNewAllowance({...newAllowance, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select 
                    value={newAllowance.type} 
                    onValueChange={(value) => setNewAllowance({...newAllowance, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                      <SelectItem value="One-time">One-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0"
                    value={newAllowance.amount}
                    onChange={(e) => setNewAllowance({...newAllowance, amount: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="applicableTo">Applicable To</Label>
                <Select 
                  value={newAllowance.applicableTo} 
                  onValueChange={(value) => setNewAllowance({...newAllowance, applicableTo: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Employees">All Employees</SelectItem>
                    <SelectItem value="Field Officers">Field Officers</SelectItem>
                    <SelectItem value="Sales Managers">Sales Managers</SelectItem>
                    <SelectItem value="Managers">All Managers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddAllowanceOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAllowance}>
                  Add Allowance
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">With allowances</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Salary</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{Math.round(employees.reduce((sum, emp) => sum + emp.salary, 0) / employees.length).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Across all employees</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{employees.reduce((sum, emp) => sum + emp.salary + emp.da, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Salaries + DA</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Allowances Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Allowances</CardTitle>
          <CardDescription>Manage DA, Salary, and vehicle rates per employee</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>DA (₹)</TableHead>
                  <TableHead>Salary (₹)</TableHead>
                  <TableHead>Car Rate (₹/km)</TableHead>
                  <TableHead>Bike Rate (₹/km)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    {editingEmployeeId === employee.id ? (
                      <>
                        <TableCell className="font-medium">
                          <Input
                            value={tempEmployeeData?.name || ''}
                            onChange={(e) => tempEmployeeData && setTempEmployeeData({...tempEmployeeData, name: e.target.value})}
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={tempEmployeeData?.role || ''} 
                            onValueChange={(value) => tempEmployeeData && setTempEmployeeData({...tempEmployeeData, role: value})}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Field Officer">Field Officer</SelectItem>
                              <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                              <SelectItem value="Regional Manager">Regional Manager</SelectItem>
                              <SelectItem value="Area Manager">Area Manager</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={tempEmployeeData?.da || 0}
                            onChange={(e) => tempEmployeeData && setTempEmployeeData({...tempEmployeeData, da: parseInt(e.target.value) || 0})}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={tempEmployeeData?.salary || 0}
                            onChange={(e) => tempEmployeeData && setTempEmployeeData({...tempEmployeeData, salary: parseInt(e.target.value) || 0})}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={tempEmployeeData?.carRatePerKm || 0}
                            onChange={(e) => tempEmployeeData && setTempEmployeeData({...tempEmployeeData, carRatePerKm: parseInt(e.target.value) || 0})}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={tempEmployeeData?.bikeRatePerKm || 0}
                            onChange={(e) => tempEmployeeData && setTempEmployeeData({...tempEmployeeData, bikeRatePerKm: parseInt(e.target.value) || 0})}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{tempEmployeeData?.status || ''}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={handleSaveEmployee}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">{employee.name}</TableCell>
                        <TableCell>{employee.role}</TableCell>
                        <TableCell>₹{employee.da.toLocaleString()}</TableCell>
                        <TableCell>₹{employee.salary.toLocaleString()}</TableCell>
                        <TableCell>₹{employee.carRatePerKm}/km</TableCell>
                        <TableCell>₹{employee.bikeRatePerKm}/km</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{employee.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditEmployee(employee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}