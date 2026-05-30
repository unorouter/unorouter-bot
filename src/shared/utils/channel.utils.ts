import {
  ChannelType,
  type CategoryChannel,
  type ForumChannel,
  type Guild,
  type GuildBasedChannel,
  type TextChannel,
} from "discord.js";

/**
 * Channels are matched by NAME (substring, case-insensitive) so renames that only
 * add emoji or separators (e.g. "ticket-logs" -> "📄│ticket-logs") keep working.
 * Config values hold the stable slug (e.g. "ticket-logs"), not a Discord id.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findChannelByName(
  guild: Guild,
  name: string,
  type?: ChannelType,
): GuildBasedChannel | null {
  if (!name) return null;
  const target = normalize(name);
  const match = guild.channels.cache.find(
    (c) =>
      (type === undefined || c.type === type) &&
      normalize(c.name).includes(target),
  );
  return match ?? null;
}

export function findTextChannel(
  guild: Guild,
  name: string,
): TextChannel | null {
  return (findChannelByName(guild, name, ChannelType.GuildText) as TextChannel) ?? null;
}

export function findForumChannel(
  guild: Guild,
  name: string,
): ForumChannel | null {
  return (findChannelByName(guild, name, ChannelType.GuildForum) as ForumChannel) ?? null;
}

export function findCategory(
  guild: Guild,
  name: string,
): CategoryChannel | null {
  return (findChannelByName(guild, name, ChannelType.GuildCategory) as CategoryChannel) ?? null;
}
