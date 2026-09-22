// Normalize established purposes while retaining genuine custom purposes.
// Visit records contain both labels and enum-like values, often with inconsistent casing.
const MAIN_PURPOSES = new Map([
  ['first visit', 'First visit'],
  ['monthly visit', 'Monthly visit'],
  ['order', 'Order'],
  ['gifting', 'Gifting'],
  ['special enquiry', 'Special enquiry'],
  ['routine visit', 'Routine Visit'],
  ['document collection', 'Document Collection'],
  ['nc follow up', 'NC Follow-up'],
  ['technical discussion', 'Technical Discussion'],
  ['order follow up', 'Order Follow-up'],
  ['payment follow up', 'Payment Follow-up'],
  ['follow up', 'Follow Up'],
  ['follow up meeting', 'Follow Up'],
]);

const displayPurpose = (key: string) => key.replace(/\b\w/g, (letter) => letter.toUpperCase());

export function summarizeVisitPurposes(rows: ReadonlyArray<{ purpose?: string | null; count: number }>) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!Number.isFinite(row.count) || row.count <= 0) continue;
    const key = (row.purpose || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const purpose = key ? MAIN_PURPOSES.get(key) || displayPurpose(key) : 'Others';
    totals.set(purpose, (totals.get(purpose) || 0) + row.count);
  }
  return [...totals].map(([purpose, visits]) => ({ purpose, visits })).sort((a, b) =>
    a.purpose === 'Others' ? 1 : b.purpose === 'Others' ? -1 : b.visits - a.visits || a.purpose.localeCompare(b.purpose));
}
