import { isStaff, safeDeferReply, safeEditReply } from "@/core/utils/command.utils";
import { BOT_NAME, WEBSITE_URL } from "@/shared/config/branding";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  CommandInteraction,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";
import { Discord, Slash } from "discordx";

@Discord()
export class ClaimPanelCommand {
  @Slash({
    name: "claim-panel",
    description: "Post the link-and-claim panel in this channel",
    dmPermission: false,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
  })
  async claimPanel(interaction: CommandInteraction) {
    if (!(await safeDeferReply(interaction, { flags: [MessageFlags.Ephemeral] })))
      return;

    if (!isStaff(interaction.member as GuildMember)) {
      await safeEditReply(interaction, "You are not allowed to use this command.");
      return;
    }

    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await safeEditReply(interaction, "Run this in a text channel.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Link your ${BOT_NAME} account`)
      .setDescription(
        [
          `Connect your Discord to your ${BOT_NAME} account to unlock the linked role and claim your one-time welcome bonus.`,
          "",
          `**How:** open ${WEBSITE_URL} -> Settings -> connect Discord, then click the button below.`,
        ].join("\n"),
      )
      .setColor(0x9b59ff);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_connect")
        .setLabel("Verify & Claim")
        .setEmoji("🔗")
        .setStyle(ButtonStyle.Success),
    );

    await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    await safeEditReply(interaction, "Claim panel posted.");
  }
}
