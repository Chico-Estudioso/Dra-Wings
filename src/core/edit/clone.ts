// Copia profunda segura también para borradores de Immer (structuredClone no admite proxies).
import { current, isDraft } from 'immer';

export function deepClone<T>(value: T): T {
  return structuredClone(isDraft(value) ? (current(value as object) as T) : value);
}
