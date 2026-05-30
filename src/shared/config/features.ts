// Feature flags parsed from environment variables

// Leveling is ON by default; set SHOULD_USER_LEVEL_UP=false to disable.
export const SHOULD_USER_LEVEL_UP =
  process.env.SHOULD_USER_LEVEL_UP?.trim() !== "false";
