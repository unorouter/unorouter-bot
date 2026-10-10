// Feature flags parsed from environment variables

// Leveling is ON by default; set SHOULD_USER_LEVEL_UP=false to disable.
export const SHOULD_USER_LEVEL_UP =
  process.env.SHOULD_USER_LEVEL_UP?.trim() !== "false";

// Bot user IDs whose messages are deleted on sight (comma-separated), for
// third-party bots that spam notices we cannot disable (e.g. CommunityOne).
export const PURGE_BOT_USER_IDS = new Set(
  process.env.PURGE_BOT_USER_IDS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [],
);

// Locked voice channels renamed to show the live human member count. Match by
// NAME substring (e.g. "members:" -> renamed "members: 428"). Comma-separated.
export const MEMBERS_COUNT_CHANNELS =
  process.env.MEMBERS_COUNT_CHANNELS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

// Reaction roles: "channel-name-substring=Role Name" pairs, comma-separated. Any
// reaction on a message in the channel grants the role; removing it takes it back.
export const REACTION_ROLES: Array<{ channel: string; role: string }> = (
  process.env.REACTION_ROLES ?? "matic-roles=Matic’s Follower"
)
  .split(",")
  .map((pair) => pair.split("="))
  .filter((parts) => parts.length === 2 && parts[0]!.trim() && parts[1]!.trim())
  .map(([channel, role]) => ({
    channel: channel!.trim().toLowerCase(),
    role: role!.trim(),
  }));
