import { DeleteUserMessagesService } from "@/core/services/messages/delete-user-messages.service";
import { ModLogService } from "@/core/services/moderation/modlog.service";
import { isHelper } from "@/core/utils/command.utils";
import { HONEYPOT_CHANNEL } from "@/shared/config/spam";
import type { Message } from "discord.js";

const REASON = "Posted in the honeypot channel";

export class HoneypotService {
  // The channel tells people not to post, so only bots that spam every channel
  // write there: jail and sweep without waiting for a second signal.
  static async check(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;
    const name = "name" in message.channel ? (message.channel.name ?? "") : "";
    if (!name.toLowerCase().includes(HONEYPOT_CHANNEL)) return false;
    if (isHelper(message.member)) return false;

    await message.delete().catch(() => {});

    const params = {
      guild: message.guild,
      memberId: message.author.id,
      jail: true,
      user: message.author,
      reason: REASON,
      startChannelId: message.channelId,
    };
    await DeleteUserMessagesService.jailUser(params);

    const logged = await ModLogService.record(params.guild, {
      action: "Messages Deleted",
      targetId: params.memberId,
      reason: REASON,
    });
    void DeleteUserMessagesService.deleteUserMessages(params)
      .then((amount) => ModLogService.setAmount(logged, amount))
      .catch(() => {});
    return true;
  }
}
