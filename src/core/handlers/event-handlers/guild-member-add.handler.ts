import { VERIFIED } from "@/shared/config/roles";
import { botLogger } from "@/lib/telemetry";
import type { GuildMember } from "discord.js";

export async function handleGuildMemberAdd(
  member: GuildMember,
): Promise<void> {
  if (member.user.bot) return;
  if (!VERIFIED) return;

  const role = member.guild.roles.cache.find((r) => r.name === VERIFIED);
  if (!role || !role.editable) return;

  await member.roles
    .add(role, "Auto-verify on join")
    .catch((e) =>
      botLogger.error("Auto-verify failed", {
        member: member.id,
        error: String(e),
      }),
    );
}
