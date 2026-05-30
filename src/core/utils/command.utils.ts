import { STAFF_ROLES } from "@/shared/config/roles";
import { GuildMember } from "discord.js";
import type {
  CommandInteraction,
  InteractionDeferReplyOptions,
  InteractionEditReplyOptions,
  MessagePayload,
} from "discord.js";

// Discord API error codes for missing resources
export const UNKNOWN_MESSAGE = 10008;
export const UNKNOWN_CHANNEL = 10003;
export const UNKNOWN_INTERACTION = 10062;

export function isDiscordNotFoundError(error: unknown): boolean {
  const code = (error as { code?: number }).code;
  return (
    code === UNKNOWN_MESSAGE ||
    code === UNKNOWN_CHANNEL ||
    code === UNKNOWN_INTERACTION
  );
}

export async function safeDeferReply(
  interaction: CommandInteraction,
  options?: InteractionDeferReplyOptions,
): Promise<boolean> {
  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === UNKNOWN_INTERACTION) return false;
    throw error;
  }
}

export async function safeEditReply(
  interaction: CommandInteraction,
  options: string | MessagePayload | InteractionEditReplyOptions,
): Promise<boolean> {
  try {
    await interaction.editReply(options);
    return true;
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (
      code === UNKNOWN_MESSAGE ||
      code === UNKNOWN_CHANNEL ||
      code === UNKNOWN_INTERACTION
    ) {
      return false;
    }
    throw error;
  }
}

export function isStaff(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  if (STAFF_ROLES.length === 0) return false;
  return member.roles.cache.some((role) => STAFF_ROLES.includes(role.name));
}
