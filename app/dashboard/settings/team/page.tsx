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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { Users, Plus, Edit, Save, X, MapPin, User, Building, Crown, Navigation, Loader2 } from "lucide-react";
import { API } from "@/lib/api";

type Team = {
  id: number;
  name: string;
  regionalManager: string;
  regionalManagerId?: number; // Add employee ID for API calls
  cities: string[];
  fieldOfficers: string[];
};

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

// Custom Team Card Component with enhanced UI
function TeamCard({ team, onEdit }: { team: Team; onEdit: (team: Team) => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow h-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription className="mt-1 flex items-center gap-1">
                <Crown className="h-4 w-4" />
                {team.regionalManager}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEdit(team)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Cities Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Cities ({team.cities.length})
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {team.cities.map((city: string, index: number) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  <Navigation className="h-3 w-3" />
                  {city}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Field Officers Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                Field Officers ({team.fieldOfficers.length})
              </h4>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {team.fieldOfficers.map((officer: string, index: number) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{officer.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{officer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Team Stats */}
          <div className="pt-3 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold">{team.cities.length}</div>
                <div className="text-xs text-muted-foreground">Cities</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{team.fieldOfficers.length}</div>
                <div className="text-xs text-muted-foreground">Officers</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mock data
const mockTeams: Team[] = [
  {
    id: 1,
    name: "Western Region",
    regionalManager: "Alice Smith",
    cities: ["Mumbai", "Pune", "Ahmedabad", "Surat"],
    fieldOfficers: [
      "Bob Johnson",
      "Charlie Brown",
      "Diana Prince",
      "Bruce Wayne",
      "Clark Kent",
      "Peter Parker",
      "Tony Stark"
    ]
  },
  {
    id: 2,
    name: "Southern Region",
    regionalManager: "Steve Rogers",
    cities: ["Bangalore", "Chennai", "Hyderabad", "Kochi"],
    fieldOfficers: [
      "Natasha Romanoff",
      "Bruce Banner",
      "Thor Odinson",
      "Loki Laufeyson",
      "Wanda Maximoff",
      "Vision"
    ]
  },
  {
    id: 3,
    name: "Northern Region",
    regionalManager: "T'Challa",
    cities: ["Delhi", "Kolkata", "Chandigarh", "Jaipur"],
    fieldOfficers: [
      "Okoye",
      "Shuri",
      "Nakia",
      "Ramonda",
      "Scott Lang",
      "Hope van Dyne",
      "Hank Pym"
    ]
  }
];

const allEmployees = [
  "Alice Smith",
  "Bob Johnson", 
  "Charlie Brown",
  "Diana Prince",
  "Bruce Wayne",
  "Clark Kent",
  "Peter Parker",
  "Tony Stark",
  "Steve Rogers",
  "Natasha Romanoff",
  "Bruce Banner",
  "Thor Odinson",
  "Loki Laufeyson",
  "T'Challa",
  "Okoye",
  "Shuri",
  "Nakia",
  "Ramonda",
  "Wanda Maximoff",
  "Vision",
  "Scott Lang",
  "Hope van Dyne",
  "Hank Pym"
];

const allCities = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", 
  "Pune", "Ahmedabad", "Chandigarh", "Jaipur", "Surat", "Kanpur",
  "Kochi", "Lucknow", "Patna", "Bhopal", "Indore", "Nagpur"
];

export default function TeamSettings() {
  const [teams, setTeams] = useState<Team[]>(mockTeams);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isRemoveOfficerOpen, setIsRemoveOfficerOpen] = useState(false);
  const [officerPendingRemoval, setOfficerPendingRemoval] = useState<{ name: string; context: "new" | "edit" } | null>(null);
  const [newTeam, setNewTeam] = useState({
    name: "",
    regionalManager: "",
    cities: [] as string[],
    fieldOfficers: [] as string[]
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isRemovingCity, setIsRemovingCity] = useState(false);
  const [cityToRemove, setCityToRemove] = useState<{ city: string; employeeId: number } | null>(null);
  const [isRemoveCityDialogOpen, setIsRemoveCityDialogOpen] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  // Fetch employees to get IDs
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!token) return;
      
      try {
        const data = await API.getAllEmployees<Employee>();
        setEmployees(data);
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };

    fetchEmployees();
  }, [token]);

  // Helper to get employee ID by name
  const getEmployeeIdByName = (name: string): number | null => {
    const employee = employees.find(
      emp => `${emp.firstName} ${emp.lastName}`.trim() === name.trim()
    );
    return employee?.id || null;
  };

  const handleAddTeam = () => {
    if (newTeam.name && newTeam.regionalManager) {
      const newTeamObj = {
        id: teams.length + 1,
        name: newTeam.name,
        regionalManager: newTeam.regionalManager,
        cities: newTeam.cities,
        fieldOfficers: newTeam.fieldOfficers
      };
      
      setTeams([...teams, newTeamObj]);
      setIsAddTeamOpen(false);
      setNewTeam({
        name: "",
        regionalManager: "",
        cities: [],
        fieldOfficers: []
      });
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam({...team}); // Create a copy for editing
    setIsEditTeamOpen(true);
  };

  const handleSaveTeam = () => {
    if (editingTeam) {
      setTeams(teams.map(team => 
        team.id === editingTeam.id ? editingTeam : team
      ));
      setIsEditTeamOpen(false);
      setEditingTeam(null);
    }
  };

  const addCityToNewTeam = (city: string) => {
    if (!newTeam.cities.includes(city)) {
      setNewTeam({...newTeam, cities: [...newTeam.cities, city]});
    }
  };

  const removeCityFromNewTeam = (city: string) => {
    setNewTeam({...newTeam, cities: newTeam.cities.filter(c => c !== city)});
  };

  const addOfficerToNewTeam = (officer: string) => {
    if (!newTeam.fieldOfficers.includes(officer)) {
      setNewTeam({...newTeam, fieldOfficers: [...newTeam.fieldOfficers, officer]});
    }
  };

  const removeOfficerFromNewTeam = (officer: string) => {
    setNewTeam({...newTeam, fieldOfficers: newTeam.fieldOfficers.filter(o => o !== officer)});
  };

  const addCityToEditingTeam = (city: string) => {
    if (editingTeam && !editingTeam.cities.includes(city)) {
      setEditingTeam({...editingTeam, cities: [...editingTeam.cities, city]});
    }
  };

  const removeCityFromEditingTeam = async (city: string) => {
    if (!editingTeam) return;
    
    const employeeId = editingTeam.regionalManagerId || getEmployeeIdByName(editingTeam.regionalManager);
    
    if (!employeeId) {
      alert('Unable to find employee ID for regional manager. Please try again.');
      return;
    }

    // Show confirmation dialog
    setCityToRemove({ city, employeeId });
    setIsRemoveCityDialogOpen(true);
  };

  const confirmRemoveCity = async () => {
    if (!cityToRemove || !token) return;

    setIsRemovingCity(true);
    try {
      const response = await fetch(
        `/api/proxy/employee/removeAssignedCity?employeeId=${cityToRemove.employeeId}&city=${encodeURIComponent(cityToRemove.city.toLowerCase())}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove city');
      }

      // Update local state after successful API call
      if (editingTeam) {
        setEditingTeam({
          ...editingTeam,
          cities: editingTeam.cities.filter((c: string) => c !== cityToRemove.city)
        });
      }

      setIsRemoveCityDialogOpen(false);
      setCityToRemove(null);
    } catch (error) {
      console.error('Error removing city:', error);
      alert(error instanceof Error ? error.message : 'Error removing city');
    } finally {
      setIsRemovingCity(false);
    }
  };

  const addOfficerToEditingTeam = (officer: string) => {
    if (editingTeam && !editingTeam.fieldOfficers.includes(officer)) {
      setEditingTeam({...editingTeam, fieldOfficers: [...editingTeam.fieldOfficers, officer]});
    }
  };

  const removeOfficerFromEditingTeam = (officer: string) => {
    if (editingTeam) {
      setEditingTeam({...editingTeam, fieldOfficers: editingTeam.fieldOfficers.filter((o: string) => o !== officer)});
    }
  };

  const requestRemoveOfficer = (officer: string, context: "new" | "edit") => {
    setOfficerPendingRemoval({ name: officer, context });
    setIsRemoveOfficerOpen(true);
  };

  const confirmRemoveOfficer = () => {
    if (!officerPendingRemoval) return;
    if (officerPendingRemoval.context === "new") {
      removeOfficerFromNewTeam(officerPendingRemoval.name);
    } else {
      removeOfficerFromEditingTeam(officerPendingRemoval.name);
    }
    setIsRemoveOfficerOpen(false);
    setOfficerPendingRemoval(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
        </div>
        <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  placeholder="e.g., Western Region"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="regionalManager">Regional Manager</Label>
                <Select 
                  value={newTeam.regionalManager} 
                  onValueChange={(value) => setNewTeam({...newTeam, regionalManager: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select regional manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees.map((employee) => (
                      <SelectItem key={employee} value={employee}>
                        {employee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Cities</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newTeam.cities.map((city) => (
                    <Badge key={city} variant="secondary" className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {city}
                      <button 
                        onClick={() => removeCityFromNewTeam(city)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={addCityToNewTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add city" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCities
                      .filter(city => !newTeam.cities.includes(city))
                      .map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Field Officers</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newTeam.fieldOfficers.map((officer) => (
                    <Badge key={officer} variant="secondary" className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {officer}
                      <button 
                        onClick={() => requestRemoveOfficer(officer, "new")}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={addOfficerToNewTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add field officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees
                      .filter(employee => 
                        employee !== newTeam.regionalManager && 
                        !newTeam.fieldOfficers.includes(employee)
                      )
                      .map((employee) => (
                        <SelectItem key={employee} value={employee}>
                          {employee}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddTeamOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTeam}>
                  Add Team
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
            <p className="text-xs text-muted-foreground">Active teams</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regional Managers</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
            <p className="text-xs text-muted-foreground">Team leaders</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cities</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teams.reduce((total, team) => total + team.cities.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all teams</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Field Officers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teams.reduce((total, team) => total + team.fieldOfficers.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total officers</p>
          </CardContent>
        </Card>
      </div>

      {/* Teams Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Teams</h2>
        {teams.length === 0 ? (
          <Card className="p-8 text-center">
            <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No teams created yet</h3>
            <p className="text-muted-foreground mb-4">Create your first team to get started</p>
            <Button onClick={() => setIsAddTeamOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Team
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} onEdit={handleEditTeam} />
            ))}
          </div>
        )}
      </div>

      {/* Edit Team Dialog */}
      <Dialog open={isEditTeamOpen} onOpenChange={setIsEditTeamOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          {editingTeam && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editTeamName">Team Name</Label>
                <Input
                  id="editTeamName"
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({...editingTeam, name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="editRegionalManager">Regional Manager</Label>
                <Select 
                  value={editingTeam.regionalManager} 
                  onValueChange={(value) => setEditingTeam({...editingTeam, regionalManager: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees.map((employee) => (
                      <SelectItem key={employee} value={employee}>
                        {employee}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Cities</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editingTeam.cities.map((city: string) => (
                    <Badge key={city} variant="secondary" className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {city}
                      <button 
                        onClick={() => removeCityFromEditingTeam(city)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                        disabled={isRemovingCity}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={addCityToEditingTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add city" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCities
                      .filter(city => !editingTeam.cities.includes(city))
                      .map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Field Officers</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editingTeam.fieldOfficers.map((officer: string) => (
                    <Badge key={officer} variant="secondary" className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {officer}
                      <button 
                        onClick={() => requestRemoveOfficer(officer, "edit")}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={addOfficerToEditingTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add field officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees
                      .filter(employee => 
                        employee !== editingTeam.regionalManager && 
                        !editingTeam.fieldOfficers.includes(employee)
                      )
                      .map((employee) => (
                        <SelectItem key={employee} value={employee}>
                          {employee}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditTeamOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTeam}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Field Officer */}
      <Dialog open={isRemoveOfficerOpen} onOpenChange={setIsRemoveOfficerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove field officer?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove
              {" "}
              <span className="font-medium">{officerPendingRemoval?.name}</span>
              {" "}
              from this team? This will not delete the employee.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRemoveOfficerOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmRemoveOfficer}>Remove</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove City */}
      <Dialog open={isRemoveCityDialogOpen} onOpenChange={setIsRemoveCityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove City</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <span className="font-medium">{cityToRemove?.city}</span> from this team?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsRemoveCityDialogOpen(false);
                setCityToRemove(null);
              }}
              disabled={isRemovingCity}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmRemoveCity}
              disabled={isRemovingCity}
            >
              {isRemovingCity ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
