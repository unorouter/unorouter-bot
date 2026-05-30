import { db } from "@/lib/db";
import { ticket, ticketMessage } from "@/lib/db-schema";
import { botLogger } from "@/lib/telemetry";
import { STAFF_ROLES } from "@/shared/config/roles";
import { and, eq } from "drizzle-orm";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type Guild,
  type GuildMember,
  type Message,
  type TextChannel,
  ThreadAutoArchiveDuration,
  type ThreadChannel,
} from "discord.js";

const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID?.trim() || "";
const TICKET_LOG_CHANNEL = process.env.TICKET_LOG_CHANNEL?.trim() || "";

export type TicketCategory = "support" | "bug";

export class TicketService {
  static buildControls(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("ticket_reward")
        .setLabel("Approve & Reward")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger),
    );
  }

  static async open(
    guild: Guild,
    opener: GuildMember,
    category: TicketCategory,
  ): Promise<ThreadChannel | null> {
    const parent = await this.getPanelChannel(guild);
    if (!parent) {
      botLogger.error("Ticket open failed: no usable parent channel");
      return null;
    }

    const thread = await parent.threads.create({
      name: `${category}-${opener.user.username}`.slice(0, 90),
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PrivateThread,
      reason: `Ticket opened by ${opener.user.tag}`,
    });

    await thread.members.add(opener.id).catch(() => {});

    await db.insert(ticket).values({
      guildId: guild.id,
      channelId: thread.id,
      openerId: opener.id,
      category,
    });

    const staffPing = STAFF_ROLES.map((name) => {
      const role = guild.roles.cache.find((r) => r.name === name);
      return role ? `<@&${role.id}>` : "";
    })
      .filter(Boolean)
      .join(" ");

    await thread.send({
      content: `${opener} opened a **${category}** ticket. ${staffPing}`.trim(),
      components: [this.buildControls()],
      allowedMentions: { users: [opener.id], roles: STAFF_ROLES.length ? undefined : [] },
    });

    return thread;
  }

  static async logTicketMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!message.channel.isThread()) return;

    const row = await db.query.ticket.findFirst({
      where: and(
        eq(ticket.channelId, message.channel.id),
        eq(ticket.status, "open"),
      ),
    });
    if (!row) return;

    await db
      .insert(ticketMessage)
      .values({
        ticketId: row.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        content: message.content || "(no text content)",
      })
      .catch(() => {});
  }

  static async claim(thread: ThreadChannel, staff: GuildMember): Promise<boolean> {
    const row = await this.getOpenTicket(thread.id);
    if (!row) return false;
    await db
      .update(ticket)
      .set({ claimedBy: staff.id })
      .where(eq(ticket.id, row.id));
    return true;
  }

  static async close(thread: ThreadChannel): Promise<boolean> {
    const row = await this.getOpenTicket(thread.id);
    if (!row) return false;

    await db
      .update(ticket)
      .set({ status: "closed", closedAt: new Date().toISOString() })
      .where(eq(ticket.id, row.id));

    const transcript = await this.buildTranscript(row.id, thread.name);
    if (TICKET_LOG_CHANNEL) {
      const logChannel = await thread.guild.channels
        .fetch(TICKET_LOG_CHANNEL)
        .catch(() => null);
      if (logChannel?.type === ChannelType.GuildText) {
        await (logChannel as TextChannel).send({
          content: `Ticket #${row.id} (${row.category}) closed - opener <@${row.openerId}>`,
          files: [transcript],
          allowedMentions: { users: [] },
        });
      }
    }

    await thread.setArchived(true).catch(() => {});
    return true;
  }

  static async getOpenTicket(channelId: string) {
    return db.query.ticket.findFirst({
      where: and(eq(ticket.channelId, channelId), eq(ticket.status, "open")),
    });
  }

  private static async buildTranscript(
    ticketId: number,
    threadName: string,
  ): Promise<AttachmentBuilder> {
    const messages = await db.query.ticketMessage.findMany({
      where: eq(ticketMessage.ticketId, ticketId),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });

    const lines = messages.map(
      (m) => `[${m.createdAt}] ${m.authorTag}: ${m.content}`,
    );
    const body = `Transcript for ticket #${ticketId} (${threadName})\n\n${lines.join("\n")}\n`;
    return new AttachmentBuilder(Buffer.from(body, "utf-8"), {
      name: `ticket-${ticketId}.txt`,
    });
  }

  private static async getPanelChannel(
    guild: Guild,
  ): Promise<TextChannel | null> {
    // If a category id is configured, find the first text channel under it.
    if (TICKET_CATEGORY_ID) {
      const inCategory = guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildText &&
          c.parentId === TICKET_CATEGORY_ID,
      ) as TextChannel | undefined;
      if (inCategory) return inCategory;
    }
    return null;
  }
}
