/** Application time boundary. Chain/wire Unix seconds are not milliseconds. */
export type UnixMilliseconds = number & {
  readonly __unixMilliseconds: unique symbol;
};
export const MAX_UNIX_MILLISECONDS = 253402300799999;
export const MAX_UNIX_SECONDS = 253402300799n;

export function assertUnixMilliseconds(value: unknown): UnixMilliseconds {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_UNIX_MILLISECONDS
  ) {
    throw new Error("TIME_INVALID_UNIX_MILLISECONDS");
  }
  return value as UnixMilliseconds;
}

export function assertUnixSeconds(value: unknown): bigint {
  let seconds: bigint;
  if (typeof value === "bigint") seconds = value;
  else if (typeof value === "number" && Number.isSafeInteger(value))
    seconds = BigInt(value);
  else if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value))
    seconds = BigInt(value);
  else throw new Error("TIME_INVALID_UNIX_SECONDS");
  if (seconds < 0n || seconds > MAX_UNIX_SECONDS)
    throw new Error("TIME_INVALID_UNIX_SECONDS");
  return seconds;
}

export function unixSecondsToMilliseconds(value: unknown): UnixMilliseconds {
  return assertUnixMilliseconds(Number(assertUnixSeconds(value) * 1000n));
}

export function millisecondsToUnixSeconds(
  value: unknown,
  rounding: "exact" | "floor" | "ceil" = "exact",
): bigint {
  const milliseconds = BigInt(assertUnixMilliseconds(value));
  if (!["exact", "floor", "ceil"].includes(rounding))
    throw new Error("TIME_INVALID_ROUNDING");
  if (rounding === "exact" && milliseconds % 1000n !== 0n)
    throw new Error("TIME_SECONDS_PRECISION_LOSS");
  return assertUnixSeconds(
    (milliseconds + (rounding === "ceil" ? 999n : 0n)) / 1000n,
  );
}

/** Compatibility adapter only: no timezone-less text or invalid calendar dates. */
export function parseLegacyIsoMilliseconds(value: unknown): UnixMilliseconds {
  if (typeof value !== "string") throw new Error("TIME_INVALID_LEGACY_ISO");
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!m) throw new Error("TIME_EXPLICIT_TIMEZONE_REQUIRED");
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offset = m[8];
  // RFC3339 -00:00 means an unknown local offset, not a confirmed UTC zone.
  if (offset === "-00:00") throw new Error("TIME_EXPLICIT_TIMEZONE_REQUIRED");
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (offset !== "Z" &&
      (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59))
  ) {
    throw new Error("TIME_INVALID_LEGACY_ISO");
  }
  return assertUnixMilliseconds(Date.parse(value));
}
