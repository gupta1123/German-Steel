const MESSAGE_KEYS = ['message', 'detail', 'reason', 'description', 'defaultMessage'] as const;
const VALIDATION_KEYS = ['errors', 'fieldErrors', 'validationErrors', 'violations'] as const;
const METADATA_KEYS = new Set([
  'timestamp',
  'status',
  'statusCode',
  'path',
  'trace',
  'stackTrace',
  'exception',
]);

const normalizeMessage = (value: string): string => {
  const message = value.replace(/\s+/g, ' ').trim();
  if (/^<!doctype html|^<html|^<body/i.test(message)) return '';
  return message;
};

const formatFieldName = (field: string): string => {
  const label = field
    .replace(/^.*\./, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!label) return '';

  return label
    .replace(/^gst\b/i, 'GST')
    .replace(/^./, (character) => character.toUpperCase());
};

const addUniqueMessage = (messages: string[], message: string): void => {
  const normalized = normalizeMessage(message);
  if (!normalized) return;

  // Backends commonly return the same validation text twice: once as the
  // top-level `message` and once under a field such as
  // `errors.gstNumber`. The field version is formatted as
  // "GST Number: <message>", so an exact-string comparison alone does not
  // catch it.
  const withoutFieldPrefix = (value: string) =>
    value.replace(/^[A-Za-z][A-Za-z0-9 _-]{0,60}:\s*/, '').toLowerCase();
  const normalizedLower = normalized.toLowerCase();
  const normalizedCore = withoutFieldPrefix(normalized);
  const duplicateIndex = messages.findIndex((existingMessage) => {
    const existingLower = existingMessage.toLowerCase();
    return existingLower === normalizedLower || withoutFieldPrefix(existingMessage) === normalizedCore;
  });

  if (duplicateIndex === -1) {
    messages.push(normalized);
    return;
  }

  // Prefer the cleaner top-level message over a field-prefixed duplicate.
  const existingMessage = messages[duplicateIndex];
  if (withoutFieldPrefix(existingMessage) === normalizedLower) {
    messages[duplicateIndex] = normalized;
  }
};

const readValidationMessages = (value: unknown, fieldName?: string): string[] => {
  if (typeof value === 'string') {
    const message = normalizeMessage(value);
    if (!message) return [];
    return [fieldName ? `${formatFieldName(fieldName)}: ${message}` : message];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => readValidationMessages(item, fieldName));
  }

  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const explicitField = ['field', 'property', 'propertyPath'].find(
    (key) => typeof record[key] === 'string'
  );
  const explicitMessage = MESSAGE_KEYS.find((key) => typeof record[key] === 'string');

  if (explicitField && explicitMessage) {
    return readValidationMessages(
      record[explicitMessage],
      String(record[explicitField])
    );
  }

  return Object.entries(record).flatMap(([key, nestedValue]) => {
    if (METADATA_KEYS.has(key) || key === 'field' || key === 'property' || key === 'propertyPath') {
      return [];
    }
    return readValidationMessages(nestedValue, key);
  });
};

export const extractApiErrorMessage = (payload: unknown): string | null => {
  if (typeof payload === 'string') {
    return normalizeMessage(payload) || null;
  }

  if (Array.isArray(payload)) {
    const messages: string[] = [];
    payload.forEach((item) => {
      const message = extractApiErrorMessage(item);
      if (message) addUniqueMessage(messages, message);
    });
    return messages.length > 0 ? messages.join('. ') : null;
  }

  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const messages: string[] = [];

  MESSAGE_KEYS.forEach((key) => {
    if (typeof record[key] === 'string') addUniqueMessage(messages, record[key]);
  });

  VALIDATION_KEYS.forEach((key) => {
    if (!(key in record)) return;
    readValidationMessages(record[key]).forEach((message) => addUniqueMessage(messages, message));
  });

  if (messages.length === 0 && typeof record.error === 'string') {
    addUniqueMessage(messages, record.error);
  }

  if (messages.length === 0) {
    Object.entries(record).forEach(([key, value]) => {
      if (METADATA_KEYS.has(key)) return;
      readValidationMessages(value, key).forEach((message) => addUniqueMessage(messages, message));
    });
  }

  return messages.length > 0 ? messages.join('. ').slice(0, 1000) : null;
};

export const getApiErrorMessage = async (
  response: Response,
  fallbackMessage: string
): Promise<string> => {
  let responseText = '';

  try {
    responseText = (await response.text()).trim();
  } catch {
    return fallbackMessage;
  }

  if (!responseText) return fallbackMessage;

  try {
    const parsedBody: unknown = JSON.parse(responseText);
    return extractApiErrorMessage(parsedBody) || fallbackMessage;
  } catch {
    return extractApiErrorMessage(responseText) || fallbackMessage;
  }
};

export const getErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallbackMessage;
};
