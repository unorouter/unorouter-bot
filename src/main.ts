import "@dotenvx/dotenvx/config";

import { botLogger, shutdownTelemetry } from "@/lib/telemetry";
import { ConfigValidator } from "@/shared/config/validator";
import { ActivityType, GatewayIntentBits, Partials } from "discord.js";
import { Client } from "discordx";
import "./bot";

ConfigValidator.validateConfig();

const token = process.env.TOKEN;
const guildIds = process.env.GUILD_IDS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
  silent: true,
  ...(guildIds && guildIds.length ? { botGuilds: guildIds } : {}),
});

bot.once("clientReady", async () => {
  await bot.initApplicationCommands();
  botLogger.info("Bot started", { clientId: bot.user?.id });
});

bot.on("interactionCreate", (interaction) => {
  if (!interaction.guild) return;
  void bot.executeInteraction(interaction);
});

const shutdown = async (signal: string) => {
  botLogger.info(`Received ${signal}, shutting down`);
  await shutdownTelemetry();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

const main = async () => {
  if (!token) {
    botLogger.error("Could not find TOKEN in environment");
    throw new Error("Could not find TOKEN in your environment");
  }

  await bot.login(token);

  bot.user?.setPresence({
    activities: [{ name: "unorouter.ai", type: ActivityType.Watching }],
  });
};

main();
