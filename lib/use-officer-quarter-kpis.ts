'use client';

import { useEffect, useState } from 'react';
import { targetsApi } from '@/lib/targets-api';

export interface OfficerQuarterKpi {
  salesTarget: number;
  salesAchieved: number;
  approvalsTarget: number;
  approvalsAchieved: number;
}

export interface QuarterInfo {
  label: string; // e.g. "Q3"
  fyLabel: string; // e.g. "FY 2026-27"
  months: { month: number; year: number }[];
}

// Financial year runs April to March: Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar.
export const quarterForMonth = (month: number, year: number): QuarterInfo => {
  const fyStart = month >= 4 ? year : year - 1;
  const quarter = month >= 4 ? Math.floor((month - 4) / 3) + 1 : 4;
  const firstMonth = quarter === 4 ? 1 : 4 + (quarter - 1) * 3;
  const months = [0, 1, 2].map((offset) => {
    const m = firstMonth + offset;
    return { month: m, year: m >= 4 ? fyStart : fyStart + 1 };
  });
  return { label: `Q${quarter}`, fyLabel: `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`, months };
};

const SALES = new Set(['SALES_MT', 'MONTHLY_SALES_MT', 'SALES']);
const APPROVALS = new Set(['NEW_APPROVALS', 'APPROVALS']);

/**
 * Employee KPI targets (sales MT and approvals) for the financial-year quarter containing the given month.
 * Targets come from three list calls for the whole team; achieved values need one call per month, but only
 * for officers that actually have a target, so the request count stays small.
 */
export function useOfficerQuarterKpis(token: string | null | undefined, month: number, year: number) {
  const [kpis, setKpis] = useState<Map<number, OfficerQuarterKpi>>(new Map());
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const quarter = quarterForMonth(month, year);

  useEffect(() => {
    if (!token) { setKpis(new Map()); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const months = quarterForMonth(month, year).months;
      const targetLists = await Promise.allSettled(months.map((entry) => targetsApi.searchSalesTargets(token, {
        targetType: 'EMPLOYEE',
        month: entry.month,
        year: entry.year,
      })));

      const base = new Map<number, OfficerQuarterKpi>();
      targetLists.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        result.value.forEach((target) => {
          if (target.status.toUpperCase() === 'INACTIVE' || target.month !== months[index].month || (target.storeId !== 0 && target.storeId != null)) return;
          const metric = (target.metric ?? 'SALES_MT').toUpperCase();
          const entry = base.get(target.employeeId) ?? { salesTarget: 0, salesAchieved: 0, approvalsTarget: 0, approvalsAchieved: 0 };
          if (SALES.has(metric)) entry.salesTarget += target.targetTons;
          else if (APPROVALS.has(metric)) entry.approvalsTarget += target.targetTons;
          base.set(target.employeeId, entry);
        });
      });

      await Promise.all(Array.from(base.keys()).map(async (employeeId) => {
        const monthly = await Promise.allSettled(months.map((entry) => (
          targetsApi.getMonthlyEmployeeKpis(token, { employeeId, year: entry.year, month: entry.month })
        )));
        const entry = base.get(employeeId);
        if (!entry) return;
        monthly.forEach((result) => {
          if (result.status !== 'fulfilled') return;
          result.value.forEach((row) => {
            if (SALES.has(row.metric)) entry.salesAchieved += row.achievedValue;
            else if (APPROVALS.has(row.metric)) entry.approvalsAchieved += row.achievedValue;
          });
        });
      }));

      if (!cancelled) setKpis(base);
    })()
      .catch(() => { if (!cancelled) setKpis(new Map()); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, month, year, refreshKey]);

  return { kpis, loading, quarter, refresh: () => setRefreshKey((value) => value + 1) };
}
