import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";
import { handleGuildMemberAdd } from "@/core/handlers/event-handlers/guild-member-add.handler";

@Discord()
export class GuildMemberAdd {
  @On({ event: "guildMemberAdd" })
  async guildMemberAdd([member]: ArgsOf<"guildMemberAdd">): Promise<void> {
    await handleGuildMemberAdd(member);
  }
}
