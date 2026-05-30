import type { InferSelectModel } from "drizzle-orm";
import type { memberRole } from "@/lib/db-schema";
import type {
  APIEmbed,
  Collection,
  Guild,
  GuildMember,
  PartialGuildMember,
  Role,
  User,
} from "discord.js";

type MemberRole = InferSelectModel<typeof memberRole>;

export type EmbedResult = { embed: APIEmbed } | { error: string };
export type MessageResult = { message: string } | { error: string };

// AI chat
export interface AiChatResponse {
  text: string;
  gifUrl: string | null;
}

export interface MessageContext {
  context: string;
  images: string[];
}

export interface ReplyContext {
  replyContext: string;
  repliedImages: string[];
}

// Embeds
export interface UserJailedEmbedParams {
  memberId: string;
  displayName: string;
  username: string;
  reason?: string;
}

// Jail / message deletion
export interface DeleteUserMessagesParams {
  guild: Guild;
  user: User | null;
  memberId: string;
  jail: string | number | boolean;
  reason?: string;
}

// Roles service
export type UpdateDbRolesArgs = {
  oldRoles: Role[];
  newRoles: Role[];
  oldMember: GuildMember | PartialGuildMember;
  newMember: GuildMember | PartialGuildMember;
  guildRoles: Collection<string, Role>;
  memberDbRoles: MemberRole[];
};

// Spam detection
export interface UserSpamState {
  count: number;
  lastContent: string;
  lastAttachmentHashes: string[];
  recentChannels: Array<{ channelId: string; timestamp: number }>;
}

export interface SpamDetectionContext {
  accountAge: number;
  memberAge: number | null;
  channelName: string;
  username: string;
  displayName: string;
  hasCustomAvatar: boolean;
  hasBanner: boolean;
  userFlags: string[];
  isSystemAccount: boolean;
  roles: string[];
  messageLength: number;
  hasLinks: boolean;
  hasMentions: boolean;
  imageCount: number;
  messageContent: string;
}

export interface SpamDetectionResult {
  isSpam: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
}

// Grant
export type GrantSourceType = "command" | "ticket" | "bug" | "boost";

export interface GrantResult {
  linked: boolean;
  userId?: number;
  quota: number;
}
