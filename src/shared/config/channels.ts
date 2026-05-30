// Channel configurations parsed from environment variables
export const GENERAL_CHANNELS =
  process.env.GENERAL_CHANNELS?.split(",")?.map((s) => s.trim()) || [];

export const BOT_CHANNELS =
  process.env.BOT_CHANNELS?.split(",")?.map((s) => s.trim()) || [];
