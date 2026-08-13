"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface DailyPricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSuccess?: () => void;
}

interface NewBrandState {
  brandName: string;
  price: string;
  city: string;
}

const DEFAULT_BRAND_STATE: NewBrandState = {
  brandName: 'German Steels',
  price: '',
  city: ''
};

const DailyPricingModal = ({ open, onOpenChange, onCreateSuccess }: DailyPricingModalProps) => {
  const { token, userData } = useAuth();
  const [newBrand, setNewBrand] = useState<NewBrandState>(DEFAULT_BRAND_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const sanitizeCityInput = (value: string) => value.replace(/[^a-zA-Z\s-]/g, "");

  useEffect(() => {
    if (!open) {
      setNewBrand(DEFAULT_BRAND_STATE);
    }
  }, [open]);

  const employeeId = useMemo(() => userData?.employeeId ?? 86, [userData?.employeeId]);

  const handleCreateBrand = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const parsedPrice = Number(newBrand.price);
      if (Number.isNaN(parsedPrice)) {
        setIsLoading(false);
        return;
      }

      const payload = {
        brandName: newBrand.brandName.trim(),
        price: parsedPrice,
        city: newBrand.city.trim(),
        state: '',
        district: '',
        subDistrict: '',
        employeeDto: { id: employeeId }
      };

      const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/brand/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('API Error');
      }

      onCreateSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating pricing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-6">
        <DialogHeader>
          <DialogTitle>Set Today&apos;s Pricing</DialogTitle>
          <DialogDescription>
            No German Steels pricing was found for today. Please enter the latest details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="brandName">Name</Label>
            <Input
              id="brandName"
              value={newBrand.brandName}
              onChange={(e) => setNewBrand((prev) => ({ ...prev, brandName: e.target.value }))}
              className="col-span-3"
              placeholder="Enter brand name"
              disabled
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price">Pricing</Label>
            <Input
              id="price"
              type="number"
              value={newBrand.price}
              onChange={(e) => setNewBrand((prev) => ({ ...prev, price: e.target.value }))}
              className="col-span-3"
              placeholder="Enter price"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={newBrand.city}
              onChange={(e) => {
                const sanitizedValue = sanitizeCityInput(e.target.value);
                setNewBrand((prev) => ({ ...prev, city: sanitizedValue }));
              }}
              className="col-span-3"
              placeholder="Enter city"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={handleClose}>
            Close
          </Button>
          <Button
            onClick={handleCreateBrand}
            disabled={
              isLoading ||
              !newBrand.brandName.trim() ||
              !newBrand.price.trim() ||
              Number.isNaN(Number(newBrand.price)) ||
              !newBrand.city.trim()
            }
            type="button"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DailyPricingModal;
