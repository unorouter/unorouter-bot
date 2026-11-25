# CLAUDE.md, unorouter-bot

Discord bot for unorouter.com. discordx on discord.js, drizzle plus postgres-js, Gemini via `@ai-sdk/google` with key rotation. Runs on the Talos cluster, namespace `services`, deploy `unorouter-bot`. Prod is one `bun build --compile` binary on distroless (no shell, no `.env`). `bun dev` locally.

## Deploy and config

- Push to `main`. The `GHCR Image` workflow builds, `unorouter-ci` pins `k8s/deployment.yaml`, ArgoCD rolls it (10 to 20 min). Done only when ArgoCD shows the new image. `build-local.sh` is retired. Never build or push an image by hand, never push `:latest`. Local `docker build` only to check it compiles.
- Runtime env comes from OpenBao `secret/bot-env` through ESO into the `bot-env` Secret, not GitHub secrets or dotenvx. Change it with `bao kv patch` (never `put`), force sync the ExternalSecret, then `kubectl -n services rollout restart deploy/unorouter-bot`.
- Never give the bot new-api's root token again. `NEW_API_BOT_TOKEN` (bot-env) must equal `BOT_SERVICE_TOKEN` (`secret/newapi-env`). Rotate both to the same value or the bot 401s.

## Boot

`bootGuild(g)` runs per guild in parallel. Heavy backfills (level rewards, invite backlog) are NOT on boot because they loop every member. They live in the staff `!verify` command (aliases `!verify-user(s)`, `!verify-all`). Run `!verify` once after a deploy for a full reconcile.

## Conventions

- Resolve channels by NAME substring (`findTextChannel(guild, "verify")`). Never store Discord IDs in code. Emoji renames keep working.
- Brand strings are env driven (`BOT_NAME`, `WEBSITE_URL`). No hardcoded "unorouter".
- Grant amounts are env driven IN DOLLARS. `src/shared/config/rewards.ts` is the ONE place reward env vars are read (`REWARDS`, `dollarsToQuota()`, `formatDollars()`). Never `parseFloat(process.env.*_GRANT_DOLLARS)` in a service.
- Money for display ALWAYS goes through `formatDollars()`. A bare `toFixed(2)` misstates sub cent payouts ($0.025).
- new-api auth is `Authorization: <NEW_API_BOT_TOKEN>` only, no `New-Api-User`. It is a service token, and new-api `BotAuth` accepts it on only `discord_grant`, `discord_transfer`, `manage` (only `set_free_rate_limit_window_pct`) and `:id/bot_view`. A new endpoint means widening that allowlist in new-api first. Read user fields via `bot_view`, never `/api/user/:id`.
- Crash guards in `main.ts` only log, never exit.
- knip flags discordx classes as unused. They load by decorator side effect in `src/bot/index.ts`. Ignore it.
- Never use co-authored-by or any Claude reference in git, no dash punctuation or Unicode arrows, no tests unless asked, comments only for a non-obvious why, no barrel files when splitting modules.

## Member count channels

`MEMBERS_COUNT_CHANNELS` (name substrings) are renamed to the live non-bot count. Discord caps renames at 2 per 10 min per channel.

## Server tag reward

- Pays per FULL DAY the guild tag is worn, as wear windows in `server_tag_wears`. Dropping the tag discards partial progress, so toggling cannot manufacture time. A partial unique index allows one open window per member.
- Gate on `identityEnabled === true` AND `identityGuildId === guildId`. Discord leaves a STALE identity guild id on people who wore a since-renamed tag.
- `reconcile()` (boot and hourly) never backdates credit and closes a stale window WITHOUT paying. So no tag backfill command is needed.
- Payouts are HELD, not skipped, when the user is unlinked or upstream refuses (`ipDuplicate`), capped at `MAX_CATCHUP_PAYOUTS` per tick.
- Discord has NO API to SET a user's tag. Do not build an "apply the tag" button.

## Changing reward amounts

Amounts live in OpenBao `secret/bot-env`, not in code. The bot serves them at `GET /rewards` (port 4000, cluster internal) and the site docs fetch it hourly, so a cut needs no site deploy or translation edit.

Vars `CONNECT_GRANT_DOLLARS`, `VOTE_GRANT_DOLLARS`, `BOOST_GRANT_DOLLARS`, `INVITE_GRANT_DOLLARS`, `SERVER_TAG_GRANT_DOLLARS`, `LEVEL_GRANT_DOLLARS` (comma list positional to `LEVEL_ROLES`). `0` disables a reward and the panels switch to "free balance" wording. Bug bounty has no env var, staff type the amount.

```bash
bao kv patch -mount=secret bot-env CONNECT_GRANT_DOLLARS=0.50 VOTE_GRANT_DOLLARS=0.025
kubectl -n services annotate externalsecret bot-env force-sync=$(date +%s) --overwrite
kubectl -n services rollout restart deploy/unorouter-bot
kubectl -n services port-forward deploy/unorouter-bot 4000   # then, in another shell
curl -s localhost:4000/rewards
```

Then re-run `/verify-panel` and `/vote-panel` (`purgeOwnPanels` makes that idempotent).

- Deploy the bot BEFORE patching OpenBao when the formatter changed, or panels advertise a rounded figure.
- Non-bot surfaces do not update. The boosters post is Don's prose. Edit it as Don and grep the pinned posts in INFORMATION for stale figures after every cut.

## Migrations

The bot runs migrations on boot, and a failure only logs "Database migration failed". Prefer drizzle-kit generate, commit, deploy. SQL applied BY HAND also needs (a) `OWNER TO unorouter` on the table, its `_id_seq` and any enum type, since the app connects as `unorouter`, and (b) the migration's sha256 inserted into `drizzle.__drizzle_migrations (hash, created_at)` with the `when` from `drizzle/meta/_journal.json`, or it replays every boot.

## Channel permissions

A locked channel (member count) or one denying `@everyone` SEND_MESSAGES needs an overwrite for the bot's GUILD ROLE (type 0), not the app id as a member (type 1, silently does nothing). Without it renames fail with `50001 Missing Access`, and a panel command purges the old post then cannot send. Restart the bot after any permission change, discord.js keeps a stale cache.

## Editing the Discord server (browser)

- Server admin work (rename or delete channels, edit pinned posts, announcements) is NOT bot code. Do it in the Discord web client over CDP. Release posts follow [RELEASE-POSTS.md](RELEASE-POSTS.md).
- Two accounts. Brave 9223 is `Don` (Admin, authored the pinned posts, only Don can edit them, the chrome-devtools MCP attaches here). Chrome 9224 is `mr.countdown`, the SERVER OWNER, for role and permission work Don cannot do. Drive it over raw CDP.
- Never use `/api/v9` with the user token. Posting that way logged the session out on 2026-10-26 and API search drew 429s. Deleting a channel is irreversible, confirm with the user first.
- To replace a bot panel, re-run its slash command. To trigger one, click the message textbox, clear it, `type_text "/verify-pa"`, wait for the listbox, press Tab then Enter.
- Discord markdown supports `[text](url)`, `<url>` suppresses the preview, mentions are `<#channelId>`, `<@&roleId>`, `<@userId>`.

## Cluster access

Kubeconfig `~/.kube/teleport-unorouter.yaml` (restart `tsh-kube` after `tsh login`). Nodes are Talos, `talosctl`, never `ssh`. Env is the `bot-env` Secret, the pod has no shell.

```bash
kubectl -n services logs deploy/unorouter-bot --tail 100 -f
```

DBs are CloudNativePG in namespace `databases`. new-api goes through `tsh db connect newapi-pg`. The bot DB is `unorouter-bot-db` on cluster `bot-pg`. Exec into its CURRENT primary only as a last resort (`kubectl -n databases get cluster bot-pg -o jsonpath='{.status.currentPrimary}'`, it drifts on failover). App user endpoints are `bot-pg-rw` and `newapi-pg-rw`, creds in OpenBao.

## Server channels (guild 1498300365001588746)

IDs are for navigation only (`discord.com/channels/1498300365001588746/<id>`). The pinned information, announcements and changelog posts are Don's, edited in place in the browser.

- INFORMATION information `1509890163285950636`, announcements `1509891684282925216`, changelog `1509906155043029202`, boosters `1510368497887084555`, verify `1510752428440555704`
- COMMUNITY general `1509888910732431490`, feature-requests `1509888593949102170`, model-requests `1510746273135722507`, bot-commands `1509889754894700637`
- SUPPORT create-ticket `1510366683070595192`, bug-bounty forum `1510366688045170708`
- LOGS moderator-only `1509890163827019859`, join-events `1509907917803884554`, ticket-logs `1510366691454882014`, grants-log `1510366694705594429`
- PRISON jail `1510366698749038706`
- Partner server, not ours. The AI Bunker (guild `1223037722998865940`), channel unorouter `1513243139064856697`. Promo intro plus mirrored changelog, posted as Don in the browser, no bot, no crosspost.
