import { db } from "@/lib/db";
import { bugReport } from "@/lib/db-schema";
import { botLogger } from "@/lib/telemetry";
import { eq } from "drizzle-orm";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ThreadChannel,
} from "discord.js";

const BUG_REPORT_FORUM_CHANNEL =
  process.env.BUG_REPORT_FORUM_CHANNEL?.trim() || "";

export class BugReportService {
  static isForumConfigured(): boolean {
    return Boolean(BUG_REPORT_FORUM_CHANNEL);
  }

  static isBugThread(thread: ThreadChannel): boolean {
    return (
      this.isForumConfigured() &&
      thread.parentId === BUG_REPORT_FORUM_CHANNEL
    );
  }

  static buildControls(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("bug_reward")
        .setLabel("Approve & Reward")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("bug_reject")
        .setLabel("Reject")
        .setStyle(ButtonStyle.Danger),
    );
  }

  static async register(thread: ThreadChannel): Promise<void> {
    if (!thread.guild || !thread.ownerId) return;

    try {
      await db.insert(bugReport).values({
        guildId: thread.guild.id,
        forumThreadId: thread.id,
        reporterId: thread.ownerId,
      });

      await thread.send({
        content: "Thanks for the report. Staff will review and may reward it.",
        components: [this.buildControls()],
      });
    } catch (err) {
      botLogger.error("Bug report register failed", { error: String(err) });
    }
  }

  static async getOpen(threadId: string) {
    const row = await db.query.bugReport.findFirst({
      where: eq(bugReport.forumThreadId, threadId),
    });
    return row && row.status === "open" ? row : null;
  }

  static async markApproved(
    threadId: string,
    resolvedBy: string,
    rewardedQuota: number,
  ): Promise<void> {
    await db
      .update(bugReport)
      .set({
        status: "approved",
        resolvedBy,
        rewardedQuota,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(bugReport.forumThreadId, threadId));
  }

  static async markRejected(
    threadId: string,
    resolvedBy: string,
  ): Promise<void> {
    await db
      .update(bugReport)
      .set({
        status: "rejected",
        resolvedBy,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(bugReport.forumThreadId, threadId));
  }
}
