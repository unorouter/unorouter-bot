import { ReactionRolesService } from "@/core/services/reaction-roles/reaction-roles.service";
import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class MessageReactionRemove {
  @On()
  async messageReactionRemove([reaction, user]: ArgsOf<"messageReactionRemove">) {
    await ReactionRolesService.toggle(reaction, user, false);
  }
}
