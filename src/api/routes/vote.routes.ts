import { VoteService } from "@/core/services/vote/vote.service";
import { logger } from "@/lib/logger";
import { VoteSite } from "@/types";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Elysia, status } from "elysia";

// Top.gg v1 signs webhooks Stripe-style. Header:
//   x-topgg-signature: t=<unix>,v1=<hmac-sha256 hex of `${t}.${rawBody}`>
// Key is the whs_ secret created on the dashboard. Verify against the RAW body
// (a re-stringified object would differ and fail), reject on >5min skew (replay).
function verifyTopggSignature(
  rawBody: string,
  header: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const ts = parts.t;
  const sig = parts.v1;
  if (!ts || !sig) return false;

  const skew = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(skew) || skew > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

type TopggBody = {
  type?: string;
  user?: string;
  guild?: string;
  data?: { user?: { platform_id?: string } };
};

// Pull the voter's Discord id from v1 (data.user.platform_id) or v0 flat (user).
function topggVoter(body: TopggBody): { test: boolean; userId: string | null } {
  if (body.type === "test" || body.type === "webhook.test") {
    return { test: true, userId: null };
  }
  return {
    test: false,
    userId: body.data?.user?.platform_id ?? body.user ?? null,
  };
}

// DiscordServers documents no payload, so the voter id and event are read
// from the usual field names and anything unrecognised is logged, not paid.
type DiscordServersBody = Record<string, unknown>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pick(body: DiscordServersBody, paths: string[][]): string | null {
  for (const path of paths) {
    let v: unknown = body;
    for (const k of path) v = isRecord(v) ? v[k] : undefined;
    if (typeof v === "string" || typeof v === "number") return String(v);
  }
  return null;
}

function discordServersVote(body: DiscordServersBody): {
  event: string | null;
  userId: string | null;
} {
  const event =
    pick(body, [
      ["event"],
      ["type"],
      ["eventType"],
      ["data", "event"],
    ])?.toLowerCase() ?? null;
  const userId = pick(body, [
    ["user", "id"],
    ["userId"],
    ["user_id"],
    ["user"],
    ["member", "id"],
    ["data", "user", "id"],
    ["data", "userId"],
  ]);
  return {
    event,
    userId: userId && /^\d{15,21}$/.test(userId) ? userId : null,
  };
}

function tokenMatches(
  header: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !header) return false;
  const given = header.replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Grant runs detached so the HTTP response returns inside Top.gg's 5s window;
// a slow grant would otherwise time out and trigger a retry (double-fire).
function rewardAsync(userId: string, site: VoteSite): void {
  void VoteService.reward(userId, site).catch((e) =>
    logger.error("Vote reward threw", { site, error: String(e) }),
  );
}

export const voteRoutes = new Elysia({ prefix: "/webhook" })
  .post(
    "/topgg",
    ({ headers, body }) => {
      const raw = typeof body === "string" ? body : "";
      if (
        !verifyTopggSignature(
          raw,
          headers["x-topgg-signature"],
          process.env.TOPGG_WEBHOOK_SECRET,
        )
      ) {
        return status("Unauthorized", "Invalid signature");
      }
      let parsed: TopggBody;
      try {
        parsed = JSON.parse(raw) as TopggBody;
      } catch {
        return status("Bad Request", "Invalid JSON");
      }
      const voter = topggVoter(parsed);
      if (voter.test) return { ok: true, test: true };
      if (!voter.userId) {
        logger.warn("Top.gg vote webhook missing voter id", {
          type: parsed.type,
        });
        return { ok: true };
      }
      rewardAsync(voter.userId, VoteSite.TopGg);
      return { ok: true };
    },
    {
      // Capture the raw body as a string so the HMAC matches Top.gg byte-for-byte.
      // A parsed-then-restringified object would differ and fail verification.
      parse: async ({ request }) => await request.text(),
    },
  )
  .post("/discordservers", ({ headers, body }) => {
    if (
      !tokenMatches(
        headers.authorization,
        process.env.DISCORDSERVERS_WEBHOOK_TOKEN,
      )
    ) {
      return status("Unauthorized", "Invalid token");
    }
    const parsed: DiscordServersBody = isRecord(body) ? body : {};
    const vote = discordServersVote(parsed);
    if (
      !vote.event ||
      !["gems", "bump", "vote"].includes(vote.event) ||
      !vote.userId
    ) {
      logger.info("DiscordServers webhook not paid", {
        event: vote.event,
        payload: JSON.stringify(parsed).slice(0, 800),
      });
      return { ok: true };
    }
    rewardAsync(vote.userId, VoteSite.DiscordServers);
    return { ok: true };
  });

// Discords.com gives a temp Discord role on upvote (configured on their
// dashboard), not a webhook, so there is no /webhook/discords route.
