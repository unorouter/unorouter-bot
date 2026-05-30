# unorouter-bot

Discord bot for the unorouter community. A slim derivative of the coding.global bot
that reuses its AI-chat and moderation engines, plus a ticket system, a bug-report
forum, and a balance-grant integration with new-api.

## Features

- **AI chat** - mention the bot (or reply to it, or start a message with its name) and it
  answers via Google Gemini, with key rotation + model fallback. Optional meme-GIF tool.
- **Moderation** - AI first-message spam detection, duplicate + cross-channel spam
  detection, jail role + message cleanup.
- **Leveling** - message-count based level roles (`LEVEL_ROLES`), with self-assign
  protection on `guildMemberUpdate`.
- **Tickets** - `/ticket-panel` posts a panel with "Open Ticket" / "Report a Bug"
  buttons. Tickets are private threads, transcripted to `TICKET_LOG_CHANNEL` on close.
  Staff controls: Claim, Approve & Reward, Close.
- **Bug reports** - both a ticket category and a public forum (`BUG_REPORT_FORUM_CHANNEL`).
  New forum threads get staff "Approve & Reward" / "Reject" buttons.
- **Balance grants** - staff reward users who linked their Discord on unorouter. Repeatable.
  Triggers: `/grant`, ticket/bug "Approve & Reward" buttons, and automatic on server boost
  (`BOOST_GRANT_QUOTA`). Every grant is recorded in `GrantLog`.

## Architecture

Cloned from the coding.global bot:

- discordx `Client` + decorator registry (`@Discord`/`@On`/`@Slash`/`@ButtonComponent`/`@ModalComponent`).
- Every `src/bot/**` file is imported in `src/bot/index.ts`; `tsup.config.ts` fails the
  build if any decorated file is missing or stale.
- Layering: `bot/` (thin) -> `core/handlers` -> `core/services` -> `core/embeds`.
- `lib/db.ts` is a postgres-js + drizzle singleton; schema in `src/lib/db-schema`.

## Balance grant flow

1. User clicks a staff "Approve & Reward" button (or staff runs `/grant`, or a boost fires).
2. The bot POSTs `${NEW_API_URL}/api/user/discord_grant` with
   `Authorization: Bearer ${NEW_API_ADMIN_TOKEN}` (a new-api admin user's access token)
   and body `{ discord_id, quota }`.
3. new-api resolves the user by Discord ID (`FillUserByDiscordId`) and, if linked, adds
   quota (`IncreaseUserQuota`). It returns `{ linked, user_id }`.
4. On `linked: true` the bot writes a `GrantLog` row and announces in `GRANT_LOG_CHANNEL`.
   On `linked: false` the user is told to link their Discord on unorouter first.

`NEW_API_URL` should be the internal service URL on the `proxy` network
(e.g. `http://unorouter-new-api:3000`) so grants never leave the host.

## Development

```bash
bun install
cp .env.example .env   # fill in TOKEN, DATABASE_URL, etc.
bun run db:push        # sync schema to your Postgres
bun run dev
```

## Build

```bash
bun run build          # tsup -> dist/main.js (also runs the bot-imports check)
```

## Deploy

Deployed on the `don` host via GitHub Actions (`.github/workflows/docker.yml`), self-hosted
runner: it writes `.env` from repo secrets and runs `docker compose up -d --force-recreate --build`.
Never ship images manually. The new-api endpoint ships through new-api's own CI.
