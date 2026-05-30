import { db } from "@/lib/db";
import { grantLog } from "@/lib/db-schema";
import { botLogger } from "@/lib/telemetry";
import { WEBSITE_URL } from "@/shared/config/branding";
import { bot } from "@/main";
import type { GrantResult, GrantSourceType } from "@/types";
import {
  ChannelType,
  type GuildMember,
  type PartialGuildMember,
  type TextChannel,
} from "discord.js";

const NEW_API_URL = process.env.NEW_API_URL?.replace(/\/$/, "") || "";
const NEW_API_ADMIN_TOKEN = process.env.NEW_API_ADMIN_TOKEN || "";
const GRANT_LOG_CHANNEL = process.env.GRANT_LOG_CHANNEL?.trim() || "";
const BOOST_GRANT_QUOTA = parseInt(process.env.BOOST_GRANT_QUOTA || "0", 10);

export class GrantService {
  static isConfigured(): boolean {
    return Boolean(NEW_API_URL && NEW_API_ADMIN_TOKEN);
  }

  /**
   * Grant quota to whoever has linked this Discord ID on unorouter.
   * Repeatable: every successful grant is appended to grantLog (audit, not a lock).
   * Returns { linked:false } when the Discord account is not linked.
   */
  static async grantQuota(params: {
    targetDiscordId: string;
    quota: number;
    reason: string;
    sourceType: GrantSourceType;
    sourceId?: string | null;
    grantedByDiscordId: string;
  }): Promise<GrantResult> {
    if (!this.isConfigured()) {
      botLogger.warn("Grant skipped: NEW_API_URL / NEW_API_ADMIN_TOKEN missing");
      return { linked: false, quota: params.quota };
    }
    if (params.quota <= 0) {
      throw new Error("Grant quota must be positive");
    }

    const res = await fetch(`${NEW_API_URL}/api/user/discord_grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEW_API_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        discord_id: params.targetDiscordId,
        quota: params.quota,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      botLogger.error("Grant request failed", {
        status: res.status,
        body: text.slice(0, 300),
      });
      throw new Error(`new-api grant failed (${res.status})`);
    }

    const json = (await res.json()) as {
      success?: boolean;
      message?: string;
      data?: { user_id?: number; linked?: boolean };
    };

    if (json.success === false) {
      throw new Error(json.message || "new-api grant rejected");
    }

    const linked = json.data?.linked ?? false;
    if (!linked) {
      return { linked: false, quota: params.quota };
    }

    const userId = json.data?.user_id;
    await db
      .insert(grantLog)
      .values({
        targetDiscordId: params.targetDiscordId,
        unorouterUserId: userId ?? null,
        quota: params.quota,
        reason: params.reason,
        sourceType: params.sourceType,
        sourceId: params.sourceId ?? null,
        grantedByDiscordId: params.grantedByDiscordId,
      })
      .catch((e) => botLogger.error("grantLog insert failed", { error: String(e) }));

    await this.announce(params.targetDiscordId, params.quota, params.reason);

    return { linked: true, userId, quota: params.quota };
  }

  static linkPrompt(): string {
    return `You need to link your Discord account on ${WEBSITE_URL} first (Settings -> link Discord), then try again.`;
  }

  private static async announce(
    targetDiscordId: string,
    quota: number,
    reason: string,
  ): Promise<void> {
    if (!GRANT_LOG_CHANNEL) return;
    try {
      const channel = await bot.channels.fetch(GRANT_LOG_CHANNEL);
      if (channel?.type === ChannelType.GuildText) {
        await (channel as TextChannel).send({
          content: `Granted **${quota}** quota to <@${targetDiscordId}> - ${reason}`,
          allowedMentions: { users: [], roles: [] },
        });
      }
    } catch (e) {
      botLogger.error("Grant announce failed", { error: String(e) });
    }
  }

  /**
   * Server boost auto-grant. Fires when premiumSince transitions null -> set.
   */
  static async handleBoost(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ): Promise<void> {
    const startedBoosting = !oldMember.premiumSince && !!newMember.premiumSince;
    if (!startedBoosting) return;
    if (BOOST_GRANT_QUOTA <= 0 || !this.isConfigured()) return;

    try {
      const result = await this.grantQuota({
        targetDiscordId: newMember.id,
        quota: BOOST_GRANT_QUOTA,
        reason: "server boost",
        sourceType: "boost",
        sourceId: null,
        grantedByDiscordId: "system",
      });

      if (!result.linked) {
        await newMember
          .send(
            `Thanks for boosting! ${this.linkPrompt()} Once linked, ping a mod to receive your boost reward.`,
          )
          .catch(() => {});
      }
    } catch (e) {
      botLogger.error("Boost grant failed", { error: String(e) });
    }
  }
}
