# CLAUDE.md — unorouter-bot

Discord bot for unorouter.ai. discordx (decorators), drizzle + postgres-js, Google Gemini for AI chat. Deployed on don server via GitHub Actions only — never ship binaries manually.

## Stack

- Runtime: Node 22 (alpine in prod), bun in dev (`bun dev`)
- Framework: discordx 11 on discord.js 14
- DB: Drizzle ORM + postgres-js (`src/lib/db/`, schema in `src/lib/db-schema/`)
- AI: `@ai-sdk/google` with GoogleClientRotator (key rotation)
- Build: tsup → `dist/main.js`
- Env: dotenvx (`bun start` → `dotenvx run --env NODE_ENV=production -- node dist/main.js`)

## Deploy

GitHub Actions only. Workflow `.github/workflows/docker-prod.yml` builds + ships. Local `docker build` fine for verifying compile, never `docker save | ssh ... docker load`. Commit, push, watch `gh run list -R unorouter/unorouter-bot --limit 1`.

Env vars live as GitHub repo secrets (`gh secret list -R unorouter/unorouter-bot`). When a secret value changes, set it AND push a trivial commit so the workflow re-renders `.env` into the container.

## Architecture

```
src/main.ts                                  bot entry, intents, lifecycle, crash guards
src/bot/index.ts                             discordx decorator loader (static imports only)
src/bot/commands/staff/                      slash commands: /grant /verify-panel /ticket-panel /verify-users
src/bot/events/                              gateway listeners: ai-chat, guild-member-add/-update, message-create, thread-create
src/bot/interactions/                        button + modal handlers: claim_connect, ticket_*, bug_*, reward_modal
src/core/services/grant/grant.service.ts     new-api /api/user/discord_grant client, connect/boost bonuses, log channel announce
src/core/services/roles/                     role + jail isolation logic
src/core/services/messages/                  XP + level-up
src/core/utils/command.utils.ts              purgeOwnPanels, safeDefer/EditReply, isStaff
src/shared/config/                           env-driven branding, roles, levels, features
src/shared/utils/channel.utils.ts            NAME-substring channel resolution (emoji-rename resilient)
src/lib/telemetry.ts                         botLogger (PostHog + stdout)
src/lib/db-schema/                           drizzle schema: guild, member, memberGuild, memberRole, memberMessages, ticket, ticketMessage, bugReport, grantLog
```

### Conventions

- Channel resolution by NAME substring via `findTextChannel(guild, "verify")` etc. Never store Discord IDs in code. Emoji renames (`verify` → `✅│verify`) keep working.
- Brand strings env-driven: `BOT_NAME`, `WEBSITE_URL`. No hardcoded "unorouter".
- All grant amounts ENV-DRIVEN IN DOLLARS, converted via `dollarsToQuota()` (`QUOTA_PER_DOLLAR`, default `500000` = $1).
- new-api auth: requires BOTH `Authorization: <NEW_API_ADMIN_TOKEN>` AND `New-Api-User: <NEW_API_USER_ID>` headers. Token = admin user's access_token from new-api `users` table.
- Crash-guard in `main.ts` — `unhandledRejection` + `uncaughtException` only log, never exit.
- discordx classes look "unused" to knip — they're loaded via decorator side-effects in `src/bot/index.ts`. Ignore those flags.
- No barrel files when splitting modules. Move symbol, update all importers via `grep`/`rg`.

## Editing the Discord server itself (Browser MCP)

Most server-admin tasks (rename channel, delete channel, edit pinned panel posts, post announcements) are NOT bot code. They go through the Discord web client via `mcp__chrome-devtools__*` tools. Brave runs with remote-debugging on port 9223; the chrome-devtools MCP attaches there.

### Get the user token (once per session)

Discord's webpack chunk push trick. Returns a 72-char user token (NOT a bot token):

```js
let token;
webpackChunkdiscord_app.push([
  [Math.random()],
  {},
  (req) => {
    for (const id in req.c) {
      const mod = req.c[id]?.exports;
      if (!mod) continue;
      for (const c of [mod, mod.default, mod.Z, mod.ZP]) {
        try {
          if (c?.getToken) {
            const v = c.getToken();
            if (typeof v === "string" && v.length > 20) token = v;
          }
        } catch {}
      }
    }
  },
]);
// `token` is now usable as Authorization header on /api/v9/*
```

### Common operations (PATCH/POST/DELETE /api/v9/\*)

All require the page to be `discord.com/channels/<guildId>/<channelId>` (or any logged-in Discord page) before the script runs.

**Find channel by name:**

```js
const r = await fetch(`/api/v9/guilds/${guildId}/channels`, {
  headers: { Authorization: token },
});
const arr = await r.json();
arr
  .filter((c) => /verify/i.test(c.name))
  .map((c) => ({ id: c.id, name: c.name, type: c.type }));
```

**Rename channel:**

```js
fetch(`/api/v9/channels/${channelId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: token },
  body: JSON.stringify({ name: "✅│verify" }),
});
```

**Delete channel** (irreversible — confirm with user first):

```js
fetch(`/api/v9/channels/${channelId}`, {
  method: "DELETE",
  headers: { Authorization: token },
});
```

**Post a message:**

```js
fetch(`/api/v9/channels/${channelId}/messages`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: token },
  body: JSON.stringify({ content: "..." }),
});
```

**Edit a message YOU AUTHORED** (user token can only PATCH your own messages, NOT the bot's):

```js
fetch(`/api/v9/channels/${channelId}/messages/${messageId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: token },
  body: JSON.stringify({ content: "..." }),
});
```

To replace a bot-authored panel embed, re-run the bot's `/verify-panel` (or equivalent) command. `purgeOwnPanels` in [src/core/utils/command.utils.ts](src/core/utils/command.utils.ts) deletes the bot's previous post in the channel before reposting, so re-running the command is idempotent.

**Pin a message:**

```js
fetch(`/api/v9/channels/${channelId}/pins/${messageId}`, {
  method: "PUT",
  headers: { Authorization: token },
});
```

**List server's registered slash commands** (resolve `verify-panel` etc. to command id):

```js
fetch(`/api/v9/applications/${botAppId}/guilds/${guildId}/commands`, {
  headers: { Authorization: token },
});
```

### Trigger a bot slash command without typing

Discord guild-command sync can lag a few seconds after deploy. Instead of typing `/verify-panel` and pressing Tab+Enter, drive the textbox via `mcp__chrome-devtools__type_text` after focusing the message input (`role="textbox"`, classes include `slateTextArea_*`):

1. `click` the textbox uid
2. `press_key Control+a` then `Delete` to clear
3. `type_text "/verify-pa"` — wait for the listbox to surface `/verify-panel`
4. `press_key Tab` to insert the slash-command chip
5. `press_key Enter` to send

### Markdown that works in Discord messages

- `[text](url)` IS supported in regular messages (so URLs can be hidden). Earlier note that "plain messages don't render markdown links" was wrong.
- `<url>` brackets suppress link embed preview.
- Channel mentions: `<#1510752428440555704>` (no name required, channel resolves to its current name).
- Role mentions: `<@&roleId>`. User mentions: `<@userId>`.

### Where common channel IDs live

Don't hardcode. Each session, refetch via the `guilds/${guildId}/channels` endpoint above. The bot doesn't need IDs at all (NAME substring resolution).

## SSH access (don server, for diagnostics only)

```bash
ssh -o StrictHostKeyChecking=no don@152.53.135.101 "docker logs unorouter-bot --tail 100"
ssh -o StrictHostKeyChecking=no don@152.53.135.101 "docker exec unorouter-bot env | grep -E 'NEW_API|BOT_NAME'"
ssh -o StrictHostKeyChecking=no don@152.53.135.101 "docker exec unorouter-bot cat /app/.env | sed 's/=.*/=SET/'"
```

`docker exec unorouter-bot env` shows only base process env. dotenvx-loaded vars are inside the Node process but not in `env` output — `cat /app/.env` is the source of truth.

Postgres for new-api:

```bash
ssh ... "docker exec unorouter-new-api-postgres psql -U newapi -d newapi -c \"SELECT id, username, discord_id FROM users WHERE discord_id <> '' LIMIT 10;\""
```

## Don'ts

- No `co-authored-by` / "Generated with Claude Code" / Claude refs in commits, PRs, issues.
- No ASCII-dash punctuation. No em/en dash, no Unicode arrows in source/commits.
- No tests unless explicitly requested.
- No bloated comments. Comment only non-obvious WHY, one terse line. No restating code.
- No barrel re-export files when splitting modules. Rewrite each importer.
- Don't manually deploy to don. CI only.
- Don't reset/regenerate new-api `SYSTEM_ACCESS_TOKEN` casually — every secret consumer (`NEW_API_ADMIN_TOKEN` here) breaks until re-set.
