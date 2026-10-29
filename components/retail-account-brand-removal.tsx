"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { AdminRemovalAction } from '@/components/admin-removal-action';
import { adminRemovalPaths, hasAdminRemovalRole } from '@/lib/admin-removals-api';
import { RetailAPI, type RetailBrandUsage } from '@/lib/retail-api';
import { Button } from '@/components/ui/button';

/** Use actual account-brand usage IDs, never the legacy visit insight IDs. */
export function RetailAccountBrandRemoval({ accountId }: { accountId: number }) {
  const { token, userRole, currentUser } = useAuth();
  const [brands, setBrands] = useState<RetailBrandUsage[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const allowed = hasAdminRemovalRole(userRole, currentUser);
  useEffect(() => {
    if (!allowed || !token || accountId < 1) return;
    let cancelled = false; setLoading(true); setError('');
    RetailAPI.getActiveBrands(accountId, token).then(items => { if (!cancelled) setBrands(items.filter(item => item.active !== false)); })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load account brands.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountId, allowed, token, version]);
  if (!allowed || accountId < 1) return null;
  return <section className="mb-4 space-y-2 rounded-lg border p-3"><h3 className="text-sm font-medium">Retail account brands</h3><p className="text-xs text-muted-foreground">Removing a brand here affects the whole customer account, including a brand added during another visit. Visit-only pros and cons stay in history.</p>
    {loading ? <p role="status" className="text-sm">Loading account brands…</p> : error ? <div><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => setVersion(value => value + 1)}>Try again</Button></div> : brands.length ? <ul className="divide-y">{brands.map(brand => <li key={brand.id} className="flex items-center justify-between gap-2 py-2"><span className="text-sm">{brand.brandName}</span><AdminRemovalAction endpoint={adminRemovalPaths.retailBrand(brand.id)} label="Remove brand" name={brand.brandName} description="Remove this brand from the whole retail account’s active brands. This does not remove just the current visit’s remarks." onRemoved={() => setVersion(value => value + 1)} /></li>)}</ul> : <p className="text-sm text-muted-foreground">No active account brands.</p>}
  </section>;
}
