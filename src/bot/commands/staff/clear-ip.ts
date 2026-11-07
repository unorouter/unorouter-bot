import { db } from "@/lib/db";
import { rewardRefusal } from "@/lib/db-schema";
import { logger } from "@/lib/logger";
import { manageUser, type RewardIpCheckData } from "@/lib/new-api/openapi";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import {
  HELPER_COMMAND_PERMISSION,
  isHelper,
  isModerator,
  safeEditReply,
  startStaffCommand,
} from "@/core/utils/command.utils";
import {
  ApplicationCommandOptionType,
  CommandInteraction,
  GuildMember,
  User,
} from "discord.js";
import { Discord, Slash, SlashOption } from "discordx";
import { and, desc, eq, isNotNull } from "drizzle-orm";

const ACTION = "reward_ip_clear";

async function rewardIp(
  userId: number,
  apply: boolean,
): Promise<RewardIpCheckData | null> {
  const res = await manageUser({
    id: userId,
    action: ACTION,
    value: apply ? 1 : 0,
    mode: apply ? "" : "check",
    groups: null,
  }).catch((e) => {
    logger.error("Reward IP manage call failed", {
      user: userId,
      error: String(e),
    });
    return null;
  });
  return res?.data.success ? (res.data.data.reward_ip ?? null) : null;
}

function describe(info: RewardIpCheckData): string {
  const parts = [
    `${info.earlier_accounts} older account(s) share the sign-up IP`,
    `${info.earlier_rewarded} of them already rewarded`,
  ];
  if (info.earlier_same_email)
    parts.push(`${info.earlier_same_email} with the same email`);
  return parts.join(", ");
}

@Discord()
export class ClearIpCommand {
  @Slash({
    name: "clear-ip",
    description:
      "Lift the duplicate IP reward block for a member on a shared VPN or network",
    dmPermission: false,
    defaultMemberPermissions: HELPER_COMMAND_PERMISSION,
  })
  async clearIp(
    @SlashOption({
      name: "member",
      description: "Member whose rewards are refused for a shared IP",
      required: true,
      type: ApplicationCommandOptionType.User,
    })
    user: User,
    @SlashOption({
      name: "force",
      description:
        "Moderators: clear even when an older account on that IP was rewarded",
      required: false,
      type: ApplicationCommandOptionType.Boolean,
    })
    force: boolean | undefined,
    interaction: CommandInteraction,
  ) {
    if (!(await startStaffCommand(interaction, isHelper))) return;
    const reply = (content: string) =>
      safeEditReply(interaction, { content, allowedMentions: { parse: [] } });

    // The refusal carries the platform account the reward was meant for.
    const refusal = await db.query.rewardRefusal.findFirst({
      where: and(
        eq(rewardRefusal.targetMemberId, user.id),
        eq(rewardRefusal.reason, "ip_duplicate"),
        isNotNull(rewardRefusal.newApiUserId),
      ),
      orderBy: desc(rewardRefusal.createdAt),
      columns: { newApiUserId: true },
    });
    if (!refusal?.newApiUserId)
      return reply(
        `<@${user.id}> has no duplicate IP refusals on record, nothing to clear.`,
      );

    const check = await rewardIp(refusal.newApiUserId, false);
    if (!check)
      return reply("Could not reach the platform, try again in a minute.");
    if (check.cleared)
      return reply(
        `<@${user.id}> is already cleared. If rewards still fail, it is something else.`,
      );

    const summary = describe(check);
    const looksLikeAlt =
      check.earlier_rewarded > 0 || check.earlier_same_email > 0;
    const forced =
      Boolean(force) && isModerator(interaction.member as GuildMember);
    if (looksLikeAlt && !forced)
      return reply(
        `Not cleared: ${summary}. That looks like a second account claiming again. A moderator can override with \`force\`.`,
      );

    const applied = await rewardIp(refusal.newApiUserId, true);
    if (!applied?.cleared)
      return reply("The platform refused the change, try again in a minute.");

    await ModLogService.record(interaction.guild!, {
      action: "Reward IP Cleared",
      targetId: user.id,
      moderatorId: interaction.user.id,
      reason: `${summary}${forced && looksLikeAlt ? " (forced)" : ""}`,
    });
    return reply(
      `Cleared <@${user.id}> (${summary}). They can press Verify & Claim again; held vote and tag rewards pay on their own.`,
    );
  }
}
