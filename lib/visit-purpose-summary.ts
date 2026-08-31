// Keep established business purposes visible; custom/unspecified purposes
// remain in the total under Others. This does not change saved visit data.
const MAIN_PURPOSES = new Map([
  ['first visit', 'First visit'],
  ['monthly visit', 'Monthly visit'],
  ['order', 'Order'],
  ['gifting', 'Gifting'],
  ['special enquiry', 'Special enquiry'],
]);

export function summarizeVisitPurposes(rows: ReadonlyArray<{ purpose?: string | null; count: number }>) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!Number.isFinite(row.count) || row.count <= 0) continue;
    const key = (row.purpose || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const purpose = MAIN_PURPOSES.get(key) || 'Others';
    totals.set(purpose, (totals.get(purpose) || 0) + row.count);
  }
  return [...totals].map(([purpose, visits]) => ({ purpose, visits })).sort((a, b) =>
    a.purpose === 'Others' ? 1 : b.purpose === 'Others' ? -1 : b.visits - a.visits || a.purpose.localeCompare(b.purpose));
}
