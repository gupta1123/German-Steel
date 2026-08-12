"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-provider';
import DailyPricingModal from '@/components/DailyPricingModal';

const STORAGE_DISMISS_KEY = 'pricingModalDismissed';

const DailyPricingChecker = () => {
  const { token, userRole } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasCheckedPricing, setHasCheckedPricing] = useState(false);
  const [isDismissedForSession, setIsDismissedForSession] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = sessionStorage.getItem(STORAGE_DISMISS_KEY) === 'true';
    setIsDismissedForSession(dismissed);
  }, []);

  const checkDailyPricing = useCallback(async () => {
    if (!token || hasCheckedPricing || isDismissedForSession) return;

    const normalizedRole = (userRole ?? '').toUpperCase();
    const isAdmin = normalizedRole.includes('ADMIN');
    if (!isAdmin) return;

    try {
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 1);

      const url = `/api/proxy/brand/getByDateRange?start=${formatDate(startDate)}&end=${formatDate(endDate)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setHasCheckedPricing(true);
        return;
      }

      const data: Array<Record<string, unknown>> = await response.json();
      const hasGermanSteelsPricing = data.some(
        (item) => typeof item.brandName === 'string' && item.brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels'
      );

      if (!hasGermanSteelsPricing) {
        setIsModalOpen(true);
      }

      setHasCheckedPricing(true);
    } catch (error) {
      console.error('Error checking daily pricing:', error);
      setHasCheckedPricing(true);
    }
  }, [token, userRole, hasCheckedPricing, isDismissedForSession]);

  useEffect(() => {
    checkDailyPricing();
  }, [checkDailyPricing]);

  const handleDismiss = () => {
    setIsModalOpen(false);
    if (!isDismissedForSession) {
      setIsDismissedForSession(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(STORAGE_DISMISS_KEY, 'true');
      }
    }
  };

  const handleCreateSuccess = () => {
    handleDismiss();
  };

  return (
    <DailyPricingModal
      open={isModalOpen}
      onOpenChange={(open) => {
        if (open) {
          setIsModalOpen(true);
        } else {
          handleDismiss();
        }
      }}
      onCreateSuccess={handleCreateSuccess}
    />
  );
};

export default DailyPricingChecker;
