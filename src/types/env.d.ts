// Core/Required environment variables
interface CoreBotEnvironment {
  TOKEN: string;
  DATABASE_URL?: string;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_HOST?: string;
  POSTGRES_DB?: string;
  GUILD_IDS?: string;
}

// Feature-specific environment variables
interface FeatureBotEnvironment {
  // AI features
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  KLIPY_API_KEY: string;

  // Role system
  STAFF_ROLES: string;
  HELPER_ROLES: string;
  STATUS_ROLES: string;
  MEMBER_ROLES: string;
  LEVEL_ROLES: string;
  BOT_OWNER_ID: string;

  // Channel configuration
  GENERAL_CHANNELS: string;
  BOT_CHANNELS: string;

  // Behavior control
  IS_CONSTRAINED_TO_BOT_CHANNEL: string;
  SHOULD_USER_LEVEL_UP: string;

  // Tickets + bug reports (channel NAMES / slugs, matched by substring)
  TICKET_CATEGORY: string;
  TICKET_LOG_CHANNEL: string;
  BUG_REPORT_FORUM_CHANNEL: string;

  // Grants (new-api integration)
  NEW_API_URL: string;
  NEW_API_ADMIN_TOKEN: string;
  GRANT_LOG_CHANNEL: string;
  BOOST_GRANT_QUOTA: string;
  BOOST_CHANNEL: string;

  // Branding
  BOT_NAME: string;
  WEBSITE_URL: string;
  DISCORD_INVITE: string;
  CHAT_SYSTEM_PROMPT_OVERRIDE: string;
  BOT_ICON: string;
}

interface BotEnvironment extends CoreBotEnvironment, FeatureBotEnvironment {}

declare namespace NodeJS {
  export interface ProcessEnv extends BotEnvironment {}
}
