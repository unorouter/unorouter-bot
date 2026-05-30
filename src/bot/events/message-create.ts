import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { handleMessageCreate } from "@/core/handlers/event-handlers/message-create.handler";

@Discord()
export class MessageCreate {
  @On({ event: "messageCreate" })
  async messageCreate([message]: ArgsOf<"messageCreate">): Promise<void> {
    await handleMessageCreate(message);
  }
}
