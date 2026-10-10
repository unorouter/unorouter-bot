import { logger } from "@/lib/logger";
import { REACTION_ROLES } from "@/shared/config/features";
import type {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";

export class ReactionRolesService {
  static async toggle(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    grant: boolean,
  ): Promise<void> {
    if (user.bot || REACTION_ROLES.length === 0) return;
    const channel = reaction.message.channel;
    if (!("guild" in channel) || !channel.guild) return;
    const name = channel.name.toLowerCase();
    const entry = REACTION_ROLES.find((r) => name.includes(r.channel));
    if (!entry) return;

    const role = channel.guild.roles.cache.find((r) => r.name === entry.role);
    if (!role?.editable) return;
    const member = await channel.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const action = grant
      ? member.roles.add(role, "Reaction role")
      : member.roles.remove(role, "Reaction role removed");
    await action.catch((e) =>
      logger.error("Reaction role update failed", {
        member: user.id,
        role: role.name,
        error: String(e),
      }),
    );
  }
}
