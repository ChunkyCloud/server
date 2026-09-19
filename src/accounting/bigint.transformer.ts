import type { ValueTransformer } from 'typeorm';

// Empty outer joins can produce null even for non-nullable bigint columns
export const bigintTransformer = {
  to: (value: bigint | null | undefined) =>
    value == null ? value : value.toString(),
  from: (value: string | number | bigint | null | undefined) =>
    value == null ? value : BigInt(value),
} satisfies ValueTransformer;
