"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, CheckCircle, XCircle, Building2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heading, Text } from "@/components/ui/typography";

type Brand = {
    id: number;
    brandName: string;
    pros: string[];
    cons: string[];
};

type NewBrand = {
    brandName: string;
    pros: string[];
    cons: string[];
};

interface BrandTabProps {
    brands: Brand[];
    setBrands: React.Dispatch<React.SetStateAction<Brand[]>>;
    visitId: string;
    token: string | null;
    fetchVisitDetail: () => Promise<void>;
}

export default function BrandTab({ brands, setBrands, visitId, token, fetchVisitDetail }: BrandTabProps) {
    const [isAdding, setIsAdding] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [newBrand, setNewBrand] = useState<NewBrand>({
        brandName: "",
        pros: [],
        cons: [],
    });
    const [editingBrandId, setEditingBrandId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
    const [brandPendingDelete, setBrandPendingDelete] = useState<Brand | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const fetchBrands = useCallback(async () => {
        try {
            const response = await fetch(`/api/proxy/visit/getProCons?visitId=${visitId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            const brandsData: Brand[] = data?.map((brand: Record<string, unknown>) => ({
                id: brand.id as number,
                brandName: brand.brandName as string,
                pros: brand.pros as string[],
                cons: brand.cons as string[],
            })) || [];
            setBrands(brandsData);
        } catch (error) {
            console.error("Error fetching brands:", error);
        }
    }, [token, visitId, setBrands]);

    useEffect(() => {
        if (visitId) {
            fetchBrands();
        }
    }, [visitId, fetchBrands]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewBrand({ ...newBrand, [e.target.name]: e.target.value });
    };

    const handleAddProCon = (type: "pros" | "cons") => {
        if (newBrand[type].length < 3) {
            setNewBrand({
                ...newBrand,
                [type]: [...newBrand[type], ""],
            });
        }
    };

    const handleProConChange = (
        type: "pros" | "cons",
        index: number,
        value: string
    ) => {
        const updatedProCon = [...newBrand[type]];
        updatedProCon[index] = value;
        setNewBrand({ ...newBrand, [type]: updatedProCon });
    };

    const handleAddBrand = async () => {
        if (newBrand.brandName.trim() !== "") {
            const brand = {
                brandName: newBrand.brandName,
                pros: newBrand.pros.filter((pro) => pro.trim() !== ""),
                cons: newBrand.cons.filter((con) => con.trim() !== ""),
            };

            try {
                setIsSaving(true);
                const response = await fetch(`/api/proxy/visit/addProCons?visitId=${visitId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify([...brands, brand]),
                });

                if (response.ok) {
                    setBrands([...brands, { ...brand, id: new Date().getTime() }]); // Assign a temporary id
                    setNewBrand({ brandName: "", pros: [], cons: [] });
                    setIsAdding(false);
                } else {
                    console.error("Error adding brand:", response.statusText);
                }
            } catch (error) {
                console.error("Error adding brand:", error);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleEditBrand = (brandId: number) => {
        setIsEditing(true);
        setEditingBrandId(brandId);
        const brand = brands.find((b) => b.id === brandId);
        if (brand) {
            setNewBrand({
                brandName: brand.brandName,
                pros: brand.pros,
                cons: brand.cons,
            });
        } else {
            console.error("Brand not found");
        }
    };

    const handleUpdateBrand = async () => {
        if (newBrand.brandName.trim() !== "") {
            const updatedBrands = brands.map((brand) => {
                if (brand.id === editingBrandId) {
                    return {
                        ...brand,
                        brandName: newBrand.brandName,
                        pros: newBrand.pros.filter((pro) => pro.trim() !== ""),
                        cons: newBrand.cons.filter((con) => con.trim() !== ""),
                    };
                }
                return brand;
            });

            try {
                setIsSaving(true);
                const response = await fetch(`/api/proxy/visit/addProCons?visitId=${visitId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(updatedBrands.map((brand) => ({
                        brandName: brand.brandName,
                        pros: brand.pros,
                        cons: brand.cons,
                    }))),
                });

                if (response.ok) {
                    setBrands(updatedBrands);
                    setNewBrand({ brandName: "", pros: [], cons: [] });
                    setIsEditing(false);
                    setEditingBrandId(null);
                } else {
                    console.error("Error updating brand:", response.statusText);
                }
            } catch (error) {
                console.error("Error updating brand:", error);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const confirmDelete = async () => {
        if (!brandPendingDelete) return;
        const deletedBrand = brandPendingDelete;
        const updatedBrands = brands.filter((brand) => brand.id !== deletedBrand.id);
        try {
            setIsDeleting(true);
            const response = await fetch(`/api/proxy/visit/deleteProCons?visitId=${visitId}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify([{ brandName: deletedBrand.brandName }]),
            });

            if (response.ok) {
                setBrands(updatedBrands);
                setConfirmDeleteOpen(false);
                setBrandPendingDelete(null);
            } else {
                console.error("Error deleting brand:", response.statusText);
            }
        } catch (error) {
            console.error("Error deleting brand:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
        <div className="w-full">
            {!isAdding && !isEditing && brands && brands.length === 0 && (
                <div className="text-center py-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                            <Heading size="md" weight="medium">No brands available</Heading>
                            <Text size="sm" tone="muted">Add brand information to track pros and cons</Text>
                        </div>
                        <Button onClick={() => setIsAdding(true)} className="mt-2">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Brand
                        </Button>
                    </div>
                </div>
            )}

            {(isAdding || isEditing) && (
                <Card className="w-full mb-4 border border-border bg-card shadow-sm">
                    <CardContent className="p-4">
                        <div className="mb-4">
                            <Label className="text-sm font-medium text-foreground mb-2 block">Brand Name</Label>
                            <Input
                                name="brandName"
                                value={newBrand.brandName}
                                onChange={handleInputChange}
                                placeholder="Enter brand name"
                                className="w-full"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                    <Label className="text-sm font-medium text-foreground">Pros</Label>
                                </div>
                                <div className="space-y-1">
                                    {newBrand.pros.map((pro, index) => (
                                        <Input
                                            key={index}
                                            value={pro}
                                            onChange={(e) => handleProConChange("pros", index, e.target.value)}
                                            placeholder={`Pro ${index + 1}`}
                                            className="w-full"
                                        />
                                    ))}
                                </div>
                                {newBrand.pros.length < 3 && (
                                    <Button
                                        onClick={() => handleAddProCon("pros")}
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                    >
                                        <Plus className="mr-2 h-3 w-3" />
                                        Add Pro
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <XCircle className="h-3 w-3 text-red-600" />
                                    <Label className="text-sm font-medium text-foreground">Cons</Label>
                                </div>
                                <div className="space-y-1">
                                    {newBrand.cons.map((con, index) => (
                                        <Input
                                            key={index}
                                            value={con}
                                            onChange={(e) => handleProConChange("cons", index, e.target.value)}
                                            placeholder={`Con ${index + 1}`}
                                            className="w-full"
                                        />
                                    ))}
                                </div>
                                {newBrand.cons.length < 3 && (
                                    <Button
                                        onClick={() => handleAddProCon("cons")}
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                    >
                                        <Plus className="mr-2 h-3 w-3" />
                                        Add Con
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-border">
                            <Button
                                onClick={() => {
                                    setIsAdding(false);
                                    setIsEditing(false);
                                    setEditingBrandId(null);
                                    setNewBrand({ brandName: "", pros: [], cons: [] });
                                }}
                                variant="outline"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={isEditing ? handleUpdateBrand : handleAddBrand}
                                variant="default"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isEditing ? "Updating..." : "Adding..."}
                                    </>
                                ) : (
                                    isEditing ? "Update Brand" : "Add Brand"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {brands.length > 0 && (
                <div className="space-y-3">
                    {brands.map((brand) => (
                        <Card
                            key={brand.id}
                            className="w-full border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200"
                        >
                            <CardContent className="p-4">
                                {/* Header Section */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                                            <Building2 className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <Heading size="md" weight="semibold" className="text-foreground">
                                                {brand.brandName}
                                            </Heading>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            onClick={() => handleEditBrand(brand.id)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                        >
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            onClick={() => { setBrandPendingDelete(brand); setConfirmDeleteOpen(true); }}
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Pros and Cons Section */}
                                {(brand.pros.length > 0 || brand.cons.length > 0) && (
                                    <div className={`grid gap-4 ${brand.pros.length > 0 && brand.cons.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                        {/* Pros */}
                                        {brand.pros.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                                    </div>
                                                    <Heading size="sm" weight="medium" className="text-foreground">
                                                        Pros
                                                    </Heading>
                                                </div>
                                                <ul className="space-y-1">
                                                    {brand.pros.map((pro, index) => (
                                                        <li key={index} className="flex items-start gap-2">
                                                            <div className="flex h-1 w-1 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                                                            <Text size="sm" className="text-foreground">
                                                                {pro}
                                                            </Text>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Cons */}
                                        {brand.cons.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
                                                        <XCircle className="h-3 w-3 text-red-600" />
                                                    </div>
                                                    <Heading size="sm" weight="medium" className="text-foreground">
                                                        Cons
                                                    </Heading>
                                                </div>
                                                <ul className="space-y-1">
                                                    {brand.cons.map((con, index) => (
                                                        <li key={index} className="flex items-start gap-2">
                                                            <div className="flex h-1 w-1 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                                                            <Text size="sm" className="text-foreground">
                                                                {con}
                                                            </Text>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {!isAdding && !isEditing && brands.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border">
                    <Button onClick={() => setIsAdding(true)} className="w-full md:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Brand
                    </Button>
                </div>
            )}
        </div>
        {/* Delete Confirmation Modal */}
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Brand</DialogTitle>
                    <DialogDescription>
                        This will remove the brand and its pros/cons for this visit. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                    <Text size="sm">Brand: <span className="font-medium">{brandPendingDelete?.brandName}</span></Text>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)} disabled={isDeleting}>Cancel</Button>
                    <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                        {isDeleting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>) : ("Delete")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
