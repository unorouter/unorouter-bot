import {
  ActionRowBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

export const REWARD_MODAL_PREFIX = "reward_modal:";

// Modal id encodes: reward_modal:<source>:<sourceId>:<targetDiscordId>
export function buildRewardModal(
  source: "ticket" | "bug",
  sourceId: string,
  targetDiscordId: string,
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${REWARD_MODAL_PREFIX}${source}:${sourceId}:${targetDiscordId}`)
    .setTitle("Approve & Reward");

  const amount = new TextInputBuilder()
    .setCustomId("reward_amount")
    .setLabel("Dollar amount")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("e.g. 1 = $1");

  const reason = new TextInputBuilder()
    .setCustomId("reward_reason")
    .setLabel("Reason")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setPlaceholder("e.g. Valid bug report: fixed login crash");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(amount),
    new ActionRowBuilder<TextInputBuilder>().addComponents(reason),
  );
  return modal;
}

export function parseRewardModal(
  interaction: ModalSubmitInteraction,
): { source: string; sourceId: string; targetId: string; amount: number; reason: string } | null {
  const rest = interaction.customId.slice(REWARD_MODAL_PREFIX.length);
  const [source, sourceId, targetId] = rest.split(":");
  if (!source || !sourceId || !targetId) return null;

  // amount is in DOLLARS (may be decimal); callers convert to quota.
  const amount = parseFloat(
    interaction.fields.getTextInputValue("reward_amount").trim(),
  );
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const reason = interaction.fields.getTextInputValue("reward_reason").trim();
  return { source, sourceId, targetId, amount, reason };
}
