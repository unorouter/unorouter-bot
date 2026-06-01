// Role configurations parsed from environment variables

export const STAFF_ROLES =
  process.env.STAFF_ROLES?.split(",").map((s) => s.trim()) || [];

export const STATUS_ROLES =
  process.env.STATUS_ROLES?.split(",").map((s) => s.trim()) || [];

export const LEVEL_ROLES =
  process.env.LEVEL_ROLES?.split(",").map((s) => s.trim()) || [];

export const EVERYONE = "@everyone";

// Status role names (by convention: Verified, Jail)
export const VERIFIED =
  STATUS_ROLES.find((r) => r?.toLowerCase() === "verified") ||
  STATUS_ROLES?.[0];

export const JAIL =
  STATUS_ROLES.find((r) => r?.toLowerCase() === "jail") || STATUS_ROLES?.[1];
