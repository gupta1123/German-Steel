/** Display only: retain the original client-type value for filtering and APIs. */
export function formatClientTypeLabel(value: string | null | undefined): string {
  const label = (value ?? '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
}
