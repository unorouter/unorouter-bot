import { MessagesService } from "@/core/services/messages/messages.service";
import { DuplicateSpamService } from "@/core/services/spam/duplicate-spam.service";
import { SpamDetectionService } from "@/core/services/spam/spam-detection.service";
import { TicketService } from "@/core/services/tickets/ticket.service";
import { Message } from "discord.js";

export async function handleMessageCreate(message: Message): Promise<void> {
  const isSpam =
    await SpamDetectionService.detectSpamFirstMessageWithAi(message);
  if (isSpam) return;

  await DuplicateSpamService.checkDuplicateSpam(message);

  await MessagesService.checkWarnings(message);

  await MessagesService.addMessageDb(message);

  await MessagesService.levelUpMessage(message);

  await TicketService.logTicketMessage(message);
}
