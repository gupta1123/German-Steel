export interface CityOptionLike {
  value: string;
  label: string;
  assignedTo?: string[];
}

export const normalizeCityKey = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const preferDisplayValue = (current: string, next: string) => {
  const currentValue = current.trim();
  const nextValue = next.trim();

  if (!currentValue) return nextValue;
  if (!nextValue) return currentValue;

  const currentHasCapital = /[A-Z]/.test(currentValue);
  const nextHasCapital = /[A-Z]/.test(nextValue);

  if (!currentHasCapital && nextHasCapital) return nextValue;
  return currentValue;
};

export const buildCityOptions = <T extends CityOptionLike = CityOptionLike>(
  cities: Array<string | null | undefined>,
  createOption?: (city: string) => T
): T[] => {
  const seen = new Set<string>();
  const options: T[] = [];

  cities.forEach((city) => {
    const value = city?.trim();
    const key = normalizeCityKey(value);
    if (!value || !key || seen.has(key)) return;

    seen.add(key);
    options.push(createOption ? createOption(value) : ({ value, label: value } as T));
  });

  return options;
};

export const mergeCityOptions = <T extends CityOptionLike>(
  ...groups: Array<ReadonlyArray<T>>
): T[] => {
  const cityMap = new Map<string, T>();

  groups.forEach((group) => {
    group.forEach((option) => {
      const key = normalizeCityKey(option.value || option.label);
      if (!key) return;

      const existing = cityMap.get(key);
      if (!existing) {
        cityMap.set(key, option);
        return;
      }

      const value = preferDisplayValue(existing.value, option.value);
      const label = preferDisplayValue(existing.label, option.label);
      const assignedTo = Array.from(
        new Set([...(existing.assignedTo ?? []), ...(option.assignedTo ?? [])])
      );

      cityMap.set(key, {
        ...existing,
        ...option,
        value,
        label,
        ...(assignedTo.length > 0 ? { assignedTo } : {}),
      });
    });
  });

  return Array.from(cityMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );
};
