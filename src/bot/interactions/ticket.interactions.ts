import { GrantService } from "@/core/services/grant/grant.service";
import { TicketService } from "@/core/services/tickets/ticket.service";
import { isStaff } from "@/core/utils/command.utils";
import { botLogger } from "@/lib/telemetry";
import {
  buildRewardModal,
  parseRewardModal,
  REWARD_MODAL_PREFIX,
} from "@/bot/interactions/reward.modal";
import {
  ButtonInteraction,
  GuildMember,
  MessageFlags,
  ModalSubmitInteraction,
  ThreadChannel,
} from "discord.js";
import { ButtonComponent, Discord, ModalComponent } from "discordx";

@Discord()
export class TicketInteractions {
  @ButtonComponent({ id: "ticket_open_support" })
  async openSupport(interaction: ButtonInteraction) {
    await this.open(interaction, "support");
  }

  @ButtonComponent({ id: "ticket_open_bug" })
  async openBug(interaction: ButtonInteraction) {
    await this.open(interaction, "bug");
  }

  private async open(
    interaction: ButtonInteraction,
    category: "support" | "bug",
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const member = interaction.member as GuildMember | null;
    if (!interaction.guild || !member) {
      await interaction.editReply("Guild only.");
      return;
    }
    try {
      const thread = await TicketService.open(interaction.guild, member, category);
      if (!thread) {
        await interaction.editReply(
          "Could not open a ticket. A configured ticket category channel is required.",
        );
        return;
      }
      await interaction.editReply(`Ticket created: ${thread}`);
    } catch (err) {
      botLogger.error("Ticket open failed", { error: String(err) });
      await interaction.editReply("Failed to open ticket.");
    }
  }

  @ButtonComponent({ id: "ticket_claim" })
  async claim(interaction: ButtonInteraction) {
    const member = interaction.member as GuildMember | null;
    if (!isStaff(member)) {
      await interaction.reply({
        content: "Staff only.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    const claimed = await TicketService.claim(
      interaction.channel as ThreadChannel,
      member!,
    );
    await interaction.reply({
      content: claimed ? `Claimed by ${member}.` : "Not an open ticket.",
      allowedMentions: { users: [] },
    });
  }

  @ButtonComponent({ id: "ticket_close" })
  async close(interaction: ButtonInteraction) {
    if (!isStaff(interaction.member as GuildMember)) {
      await interaction.reply({
        content: "Staff only.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    await interaction.reply({ content: "Closing ticket..." });
    await TicketService.close(interaction.channel as ThreadChannel);
  }

  @ButtonComponent({ id: "ticket_reward" })
  async reward(interaction: ButtonInteraction) {
    if (!isStaff(interaction.member as GuildMember)) {
      await interaction.reply({
        content: "Staff only.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    const row = await TicketService.getOpenTicket(interaction.channelId);
    if (!row) {
      await interaction.reply({
        content: "Not an open ticket.",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    await interaction.showModal(
      buildRewardModal("ticket", String(row.id), row.openerId),
    );
  }

  @ModalComponent({ id: new RegExp(`^${REWARD_MODAL_PREFIX}ticket:`) })
  async rewardSubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const parsed = parseRewardModal(interaction);
    if (!parsed) {
      await interaction.editReply("Invalid amount.");
      return;
    }
    try {
      const result = await GrantService.grantQuota({
        targetDiscordId: parsed.targetId,
        quota: parsed.amount,
        reason: parsed.reason,
        sourceType: "ticket",
        sourceId: parsed.sourceId,
        grantedByDiscordId: interaction.user.id,
      });
      if (!result.linked) {
        await interaction.editReply(
          `Reporter has not linked their Discord. ${GrantService.linkPrompt()}`,
        );
        return;
      }
      await interaction.editReply(
        `Granted **${parsed.amount}** quota to <@${parsed.targetId}>.`,
      );
    } catch (err) {
      botLogger.error("Ticket reward failed", { error: String(err) });
      await interaction.editReply("Grant failed.");
    }
  }
}
