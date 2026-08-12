"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Calendar, CheckCircle, Save, Pencil } from "lucide-react";

// Mock data
const mockWorkingDaysConfig = {
  fullDayVisits: 8,
  halfDayVisits: 4
};

export default function WorkingDaysSettings() {
  const [workingDaysConfig, setWorkingDaysConfig] = useState(mockWorkingDaysConfig);
  const [tempConfig, setTempConfig] = useState(mockWorkingDaysConfig);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    setWorkingDaysConfig({...tempConfig});
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempConfig({...workingDaysConfig});
    setIsEditing(false);
  };

  const handleEdit = () => {
    setTempConfig({...workingDaysConfig});
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Full Day Requirement</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workingDaysConfig.fullDayVisits}+ visits</div>
            <p className="text-xs text-muted-foreground">Required for a full day</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Half Day Requirement</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workingDaysConfig.halfDayVisits}-{workingDaysConfig.fullDayVisits - 1} visits</div>
            <p className="text-xs text-muted-foreground">Required for a half day</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Working Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">6</div>
            <p className="text-xs text-muted-foreground">Days per week</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visit Requirements</CardTitle>
          <CardDescription>Define what constitutes a full or half day based on visits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="font-medium">Full Day Visits</Label>
                  <div className="text-2xl font-bold mt-1">{workingDaysConfig.fullDayVisits} visits</div>
                  <p className="text-sm text-muted-foreground">
                    Minimum visits required for a full day
                  </p>
                </div>
                
                <div>
                  <Label className="font-medium">Half Day Visits</Label>
                  <div className="text-2xl font-bold mt-1">{workingDaysConfig.halfDayVisits} visits</div>
                  <p className="text-sm text-muted-foreground">
                    Minimum visits required for a half day
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleEdit} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit Requirements
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullDayVisits">Full Day Visits</Label>
                  <Input
                    id="fullDayVisits"
                    type="number"
                    min="1"
                    value={tempConfig.fullDayVisits}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      fullDayVisits: parseInt(e.target.value) || 8
                    })}
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum visits required for a full day
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="halfDayVisits">Half Day Visits</Label>
                  <Input
                    id="halfDayVisits"
                    type="number"
                    min="1"
                    max={tempConfig.fullDayVisits - 1}
                    value={tempConfig.halfDayVisits}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      halfDayVisits: parseInt(e.target.value) || 4
                    })}
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Minimum visits required for a half day
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t">
            <h3 className="font-medium mb-2">How it works:</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Employees with {workingDaysConfig.fullDayVisits} or more visits are marked as full day</li>
              <li>Employees with {workingDaysConfig.halfDayVisits} to {workingDaysConfig.fullDayVisits - 1} visits are marked as half day</li>
              <li>Employees with fewer than {workingDaysConfig.halfDayVisits} visits are marked as absent</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}