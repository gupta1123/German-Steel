"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, CheckCircle, XCircle, Building2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heading, Text } from "@/components/ui/typography";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";

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
    const emptyBrand: NewBrand = { brandName: "", pros: [], cons: [] };
    const originalBrand = editingBrandId == null
        ? emptyBrand
        : brands.find((brand) => brand.id === editingBrandId) ?? emptyBrand;
    const brandDraftIsDirty = (isAdding || isEditing) && (
        newBrand.brandName !== originalBrand.brandName ||
        JSON.stringify(newBrand.pros) !== JSON.stringify(originalBrand.pros) ||
        JSON.stringify(newBrand.cons) !== JSON.stringify(originalBrand.cons)
    );
    const { requestDiscard } = useUnsavedChanges(brandDraftIsDirty);

    const cancelBrandDraft = () => {
        requestDiscard(() => {
            setIsAdding(false);
            setIsEditing(false);
            setEditingBrandId(null);
            setNewBrand({ brandName: "", pros: [], cons: [] });
        }, brandDraftIsDirty);
    };

    const fetchBrands = useCallback(async () => {
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/visit/getProCons?visitId=${visitId}`, {
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
                const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/visit/addProCons?visitId=${visitId}`, {
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
                const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/visit/addProCons?visitId=${visitId}`, {
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
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/visit/deleteProCons?visitId=${visitId}`, {
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
        <section className="w-full space-y-3" aria-labelledby="brand-insights-heading">
            {!isAdding && !isEditing && brands.length > 0 && (
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 id="brand-insights-heading" className="text-sm font-semibold text-foreground">Brand insights</h2>
                        <p className="text-xs text-muted-foreground">{brands.length} {brands.length === 1 ? "brand" : "brands"} discussed during this visit</p>
                    </div>
                    <Button onClick={() => setIsAdding(true)} size="sm" className="h-9 shrink-0">
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add brand
                    </Button>
                </div>
            )}
            {!isAdding && !isEditing && brands && brands.length === 0 && (
                <div className="rounded-lg border border-dashed bg-muted/15 px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">No brand insights yet</p>
                            <p className="mt-1 text-xs text-muted-foreground">Record strengths and concerns mentioned during this visit.</p>
                        </div>
                        <Button onClick={() => setIsAdding(true)} size="sm" className="mt-1 h-9">
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add brand
                        </Button>
                    </div>
                </div>
            )}

            {(isAdding || isEditing) && (
                <Card className="w-full gap-0 rounded-lg border-border bg-card py-0 shadow-none">
                    <CardContent className="p-4">
                        <div className="mb-4 flex items-start justify-between gap-3 border-b pb-3">
                            <div>
                                <h2 id="brand-insights-heading" className="text-sm font-semibold text-foreground">{isEditing ? "Edit brand insight" : "Add brand insight"}</h2>
                                <p className="mt-0.5 text-xs text-muted-foreground">Capture what is working and what needs attention.</p>
                            </div>
                        </div>
                        <div className="mb-4">
                            <Label className="mb-1.5 block text-xs font-medium text-foreground">Brand name</Label>
                            <Input
                                name="brandName"
                                value={newBrand.brandName}
                                onChange={handleInputChange}
                                placeholder="Enter brand name"
                                className="h-9 w-full shadow-none"
                            />
                        </div>
                        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2 rounded-md bg-emerald-50/60 p-3 dark:bg-emerald-950/20">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <Label className="text-xs font-semibold text-foreground">Strengths</Label>
                                </div>
                                <div className="space-y-1">
                                    {newBrand.pros.map((pro, index) => (
                                        <Input
                                            key={index}
                                            value={pro}
                                            onChange={(e) => handleProConChange("pros", index, e.target.value)}
                                            placeholder={`Pro ${index + 1}`}
                                            className="h-9 w-full bg-background shadow-none"
                                        />
                                    ))}
                                </div>
                                {newBrand.pros.length < 3 && (
                                    <Button
                                        onClick={() => handleAddProCon("pros")}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-full bg-background text-xs shadow-none"
                                    >
                                        <Plus className="mr-2 h-3 w-3" />
                                        Add strength
                                    </Button>
                                )}
                            </div>
                            <div className="space-y-2 rounded-md bg-rose-50/60 p-3 dark:bg-rose-950/20">
                                <div className="flex items-center gap-2">
                                    <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                    <Label className="text-xs font-semibold text-foreground">Concerns</Label>
                                </div>
                                <div className="space-y-1">
                                    {newBrand.cons.map((con, index) => (
                                        <Input
                                            key={index}
                                            value={con}
                                            onChange={(e) => handleProConChange("cons", index, e.target.value)}
                                            placeholder={`Con ${index + 1}`}
                                            className="h-9 w-full bg-background shadow-none"
                                        />
                                    ))}
                                </div>
                                {newBrand.cons.length < 3 && (
                                    <Button
                                        onClick={() => handleAddProCon("cons")}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-full bg-background text-xs shadow-none"
                                    >
                                        <Plus className="mr-2 h-3 w-3" />
                                        Add concern
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-border pt-3">
                            <Button
                                onClick={cancelBrandDraft}
                                variant="outline"
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={isEditing ? handleUpdateBrand : handleAddBrand}
                                variant="default"
                                size="sm"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isEditing ? "Updating..." : "Adding..."}
                                    </>
                                ) : (
                                    isEditing ? "Update brand" : "Add brand"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {brands.length > 0 && (
                <div className="grid gap-3">
                    {brands.map((brand) => (
                        <Card
                            key={brand.id}
                            className="w-full gap-0 overflow-hidden rounded-lg border-border bg-card py-0 shadow-none transition-colors hover:border-foreground/20"
                        >
                            <CardContent className="p-0">
                                {/* Header Section */}
                                <div className="flex items-center justify-between border-b px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                            <Building2 className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{brand.brandName}</p>
                                            <p className="text-[11px] text-muted-foreground">{brand.pros.length + brand.cons.length} observations</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            onClick={() => handleEditBrand(brand.id)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            aria-label={`Edit ${brand.brandName}`}
                                        >
                                            <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            onClick={() => { setBrandPendingDelete(brand); setConfirmDeleteOpen(true); }}
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            aria-label={`Delete ${brand.brandName}`}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Pros and Cons Section */}
                                {(brand.pros.length > 0 || brand.cons.length > 0) ? (
                                    <div className={`grid ${brand.pros.length > 0 && brand.cons.length > 0 ? 'grid-cols-1 md:grid-cols-2 md:divide-x' : 'grid-cols-1'}`}>
                                        {/* Pros */}
                                        {brand.pros.length > 0 && (
                                            <div className="bg-emerald-50/35 p-4 dark:bg-emerald-950/10">
                                                <div className="mb-2 flex items-center gap-2">
                                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                                    <p className="text-xs font-semibold text-foreground">Strengths</p>
                                                </div>
                                                <ul className="space-y-1.5">
                                                    {brand.pros.map((pro, index) => (
                                                        <li key={index} className="flex items-start gap-2 text-xs leading-5 text-foreground">
                                                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                                                            <span>{pro}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Cons */}
                                        {brand.cons.length > 0 && (
                                            <div className="bg-rose-50/35 p-4 dark:bg-rose-950/10">
                                                <div className="mb-2 flex items-center gap-2">
                                                    <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                                    <p className="text-xs font-semibold text-foreground">Concerns</p>
                                                </div>
                                                <ul className="space-y-1.5">
                                                    {brand.cons.map((con, index) => (
                                                        <li key={index} className="flex items-start gap-2 text-xs leading-5 text-foreground">
                                                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                                                            <span>{con}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">No strengths or concerns recorded.</div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

        </section>
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
