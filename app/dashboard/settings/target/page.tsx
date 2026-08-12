"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MapPin,
  User,
  Target,
  TrendingUp,
  Calendar,
  Filter,
  Plus,
  Edit,
  Trash2
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";

// Mock data for cities
const cities = [
  "All Cities",
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad"
];

// Mock data for months
const months = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" }
];

// Mock data for years
const years = [
  "2023",
  "2024",
  "2025"
];

// Mock data for city targets
const mockCityTargets = [
  {
    id: 1,
    city: "Mumbai",
    target: 5000000,
    achieved: 4200000,
    pending: 800000,
    teamMembers: [
      { id: 1, name: "Alice Smith", achieved: 1200000 },
      { id: 2, name: "Bob Johnson", achieved: 1000000 },
      { id: 3, name: "Charlie Brown", achieved: 800000 },
      { id: 4, name: "Diana Prince", achieved: 700000 },
      { id: 5, name: "Bruce Wayne", achieved: 500000 }
    ]
  },
  {
    id: 2,
    city: "Delhi",
    target: 4500000,
    achieved: 3800000,
    pending: 700000,
    teamMembers: [
      { id: 6, name: "Clark Kent", achieved: 1100000 },
      { id: 7, name: "Peter Parker", achieved: 900000 },
      { id: 8, name: "Tony Stark", achieved: 850000 },
      { id: 9, name: "Steve Rogers", achieved: 600000 },
      { id: 10, name: "Natasha Romanoff", achieved: 350000 }
    ]
  },
  {
    id: 3,
    city: "Bangalore",
    target: 4000000,
    achieved: 3200000,
    pending: 800000,
    teamMembers: [
      { id: 11, name: "Bruce Banner", achieved: 900000 },
      { id: 12, name: "Thor Odinson", achieved: 800000 },
      { id: 13, name: "Loki Laufeyson", achieved: 700000 },
      { id: 14, name: "Wanda Maximoff", achieved: 500000 },
      { id: 15, name: "Vision", achieved: 300000 }
    ]
  },
  {
    id: 4,
    city: "Hyderabad",
    target: 3500000,
    achieved: 2900000,
    pending: 600000,
    teamMembers: [
      { id: 16, name: "Scott Lang", achieved: 800000 },
      { id: 17, name: "Hope van Dyne", achieved: 700000 },
      { id: 18, name: "Hank Pym", achieved: 600000 },
      { id: 19, name: "Janet van Dyne", achieved: 500000 },
      { id: 20, name: "Ghost", achieved: 300000 }
    ]
  },
  {
    id: 5,
    city: "Chennai",
    target: 3000000,
    achieved: 2500000,
    pending: 500000,
    teamMembers: [
      { id: 21, name: "T'Challa", achieved: 700000 },
      { id: 22, name: "Okoye", achieved: 600000 },
      { id: 23, name: "Shuri", achieved: 500000 },
      { id: 24, name: "Nakia", achieved: 400000 },
      { id: 25, name: "Ramonda", achieved: 300000 }
    ]
  }
];

export default function TargetSettings() {
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [selectedMonth, setSelectedMonth] = useState("7"); // August
  const [selectedYear, setSelectedYear] = useState("2023");
  const [newTarget, setNewTarget] = useState({
    city: "",
    target: "",
    month: "7",
    year: "2023"
  });
  const [isAddingTarget, setIsAddingTarget] = useState(false);

  const filteredCityTargets = selectedCity === "All Cities" 
    ? mockCityTargets 
    : mockCityTargets.filter(cityTarget => cityTarget.city === selectedCity);

  const getProgressPercentage = (achieved: number, target: number) => {
    return Math.min(100, Math.round((achieved / target) * 100));
  };

  const handleAddTarget = () => {
    if (newTarget.city && newTarget.target) {
      // In a real app, this would make an API call to add the target
      console.log("Adding new target:", newTarget);
      setIsAddingTarget(false);
      setNewTarget({
        city: "",
        target: "",
        month: "7",
        year: "2023"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Monthly Targets</h1>
        <p className="text-muted-foreground">
          Set and track city-wise targets, achievements, and team member performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Target</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{filteredCityTargets.reduce((sum, city) => sum + city.target, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Across all cities</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Achieved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{filteredCityTargets.reduce((sum, city) => sum + city.achieved, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Current achievement</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredCityTargets.length > 0 
                ? Math.round(
                    (filteredCityTargets.reduce((sum, city) => sum + city.achieved, 0) / 
                    filteredCityTargets.reduce((sum, city) => sum + city.target, 0)) * 100
                  ) 
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Target achievement</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button className="w-full">
                <Target className="mr-2 h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              City-wise Targets
            </div>
            <Button 
              onClick={() => setIsAddingTarget(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Target
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAddingTarget ? (
            <div className="space-y-4 p-4 border rounded-lg mb-6">
              <h3 className="font-medium">Add New Target</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetCity">City</Label>
                  <Select 
                    value={newTarget.city} 
                    onValueChange={(value) => setNewTarget({...newTarget, city: value})}
                  >
                    <SelectTrigger id="targetCity">
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.filter(city => city !== "All Cities").map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="targetAmount">Target Amount (₹)</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    placeholder="0"
                    value={newTarget.target}
                    onChange={(e) => setNewTarget({...newTarget, target: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="targetMonth">Month</Label>
                  <Select 
                    value={newTarget.month} 
                    onValueChange={(value) => setNewTarget({...newTarget, month: value})}
                  >
                    <SelectTrigger id="targetMonth">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="targetYear">Year</Label>
                  <Select 
                    value={newTarget.year} 
                    onValueChange={(value) => setNewTarget({...newTarget, year: value})}
                  >
                    <SelectTrigger id="targetYear">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddingTarget(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTarget}>
                  Save Target
                </Button>
              </div>
            </div>
          ) : null}
          
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Achieved</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCityTargets.map((cityTarget) => (
                  <TableRow key={cityTarget.id}>
                    <TableCell className="font-medium">{cityTarget.city}</TableCell>
                    <TableCell>₹{cityTarget.target.toLocaleString()}</TableCell>
                    <TableCell>₹{cityTarget.achieved.toLocaleString()}</TableCell>
                    <TableCell>₹{cityTarget.pending.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={getProgressPercentage(cityTarget.achieved, cityTarget.target)} 
                          className="w-24" 
                        />
                        <span className="text-sm w-10">
                          {getProgressPercentage(cityTarget.achieved, cityTarget.target)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Team Member Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Achieved</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Performance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCityTargets.flatMap((cityTarget) => 
                  cityTarget.teamMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{cityTarget.city}</TableCell>
                      <TableCell>{member.name}</TableCell>
                      <TableCell>₹{member.achieved.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {Math.round((member.achieved / cityTarget.achieved) * 100)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={Math.min(100, Math.round((member.achieved / (cityTarget.target / cityTarget.teamMembers.length)) * 100))} 
                            className="w-24" 
                          />
                          <span className="text-sm w-10">
                            {Math.min(100, Math.round((member.achieved / (cityTarget.target / cityTarget.teamMembers.length)) * 100))}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}