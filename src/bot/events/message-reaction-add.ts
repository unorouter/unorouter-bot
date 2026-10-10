import { ExpressionUsageService } from "@/core/services/expressions/expression-usage.service";
import { ReactionRolesService } from "@/core/services/reaction-roles/reaction-roles.service";
import type { ArgsOf } from "discordx";
import { Discord, On } from "discordx";

@Discord()
export class MessageReactionAdd {
  @On()
  async messageReactionAdd([reaction, user]: ArgsOf<"messageReactionAdd">) {
    if (user.bot) return;
    await ReactionRolesService.toggle(reaction, user, true);
    // Reactions on messages older than the cache arrive partial.
    if (reaction.partial) {
      const full = await reaction.fetch().catch(() => null);
      if (!full) return;
      await ExpressionUsageService.trackReaction(full);
      return;
    }
    await ExpressionUsageService.trackReaction(reaction);
  }
}
