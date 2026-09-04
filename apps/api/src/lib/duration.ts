/**
 * Parses the small duration-string vocabulary this project actually uses
 * (`JWT_REFRESH_TTL=7d`, and the same shape for any future TTL env var) into
 * milliseconds. `jsonwebtoken`'s `sign()` accepts a string like `'15m'`
 * directly (see lib/jwt.ts), so this is only needed where *this* codebase —
 * not jsonwebtoken — has to compute an actual expiry `Date` itself, i.e. the
 * refresh token's `expires_at` column.
 *
 * Deliberately minimal rather than pulling in a duration-parsing dependency:
 * exactly one caller, exactly one format (`<integer><s|m|h|d>`).
 */
const UNIT_MS = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type Unit = keyof typeof UNIT_MS;

function isUnit(value: string | undefined): value is Unit {
  return value !== undefined && value in UNIT_MS;
}

export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${value}" (expected e.g. "15m", "7d")`);
  }
  const [, amount, unit] = match;
  if (amount === undefined || !isUnit(unit)) {
    // Unreachable given the regex above — guards `noUncheckedIndexedAccess`
    // and the capture groups' `string | undefined` typing without a
    // non-null assertion.
    throw new Error(`Invalid duration string: "${value}"`);
  }
  return Number(amount) * UNIT_MS[unit];
}
