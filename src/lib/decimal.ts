import { Prisma } from '@prisma/client';

export function decimalToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Prisma.Decimal) return value.toNumber();

  const maybeDecimal = value as { toNumber?: () => number; toString?: () => string };
  if (typeof maybeDecimal.toNumber === 'function') {
    const parsed = maybeDecimal.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(maybeDecimal.toString?.() ?? value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDecimal(value: unknown): string {
  return decimalToNumber(value).toLocaleString('id-ID');
}
