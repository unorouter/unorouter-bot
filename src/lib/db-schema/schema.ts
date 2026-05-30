import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const guild = pgTable(
  "Guild",
  {
    guildId: text().primaryKey().notNull(),
    guildName: text().notNull(),
    lookback: integer().default(9999).notNull(),
  },
  (table) => [
    uniqueIndex("Guild_guildId_key").using(
      "btree",
      table.guildId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const member = pgTable(
  "Member",
  {
    memberId: text().primaryKey().notNull(),
    username: text().notNull(),
    globalName: text(),
    createdAt: timestamp({ precision: 3, mode: "string" }),
    updatedAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    avatarUrl: text(),
    bannerUrl: text(),
    bot: boolean().default(false).notNull(),
    flags: bigint({ mode: "number" }),
    system: boolean().default(false).notNull(),
  },
  (table) => [
    uniqueIndex("Member_memberId_key").using(
      "btree",
      table.memberId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const memberGuild = pgTable(
  "MemberGuild",
  {
    id: serial().primaryKey().notNull(),
    memberId: text().notNull(),
    guildId: text().notNull(),
    status: boolean().default(true).notNull(),
    nickname: text(),
    displayName: text(),
    warnings: integer().default(0).notNull(),
    joinedAt: timestamp({ precision: 3, mode: "string" }),
    premiumSince: timestamp({ precision: 3, mode: "string" }),
    updatedAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("MemberGuild_memberId_guildId_key").using(
      "btree",
      table.memberId.asc().nullsLast().op("text_ops"),
      table.guildId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.guildId],
      foreignColumns: [guild.guildId],
      name: "MemberGuild_guildId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [member.memberId],
      name: "MemberGuild_memberId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const memberRole = pgTable(
  "MemberRole",
  {
    id: serial().primaryKey().notNull(),
    roleId: text().notNull(),
    guildId: text().notNull(),
    memberId: text().notNull(),
    name: text(),
    color: integer(),
    hexColor: text(),
    position: integer(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("MemberRole_memberId_guildId_idx").using(
      "btree",
      table.memberId.asc().nullsLast().op("text_ops"),
      table.guildId.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("MemberRole_memberId_roleId_key").using(
      "btree",
      table.memberId.asc().nullsLast().op("text_ops"),
      table.roleId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.guildId],
      foreignColumns: [guild.guildId],
      name: "MemberRole_guildId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [member.memberId],
      name: "MemberRole_memberId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

export const memberMessages = pgTable(
  "MemberMessages",
  {
    id: text().primaryKey().notNull(),
    memberId: text().notNull(),
    guildId: text().notNull(),
    messageId: text().notNull(),
    channelId: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("MemberMessages_messageId_key").using(
      "btree",
      table.messageId.asc().nullsLast().op("text_ops"),
    ),
    index("MemberMessages_memberId_guildId_idx").using(
      "btree",
      table.memberId.asc().nullsLast().op("text_ops"),
      table.guildId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.guildId],
      foreignColumns: [guild.guildId],
      name: "MemberMessages_guildId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [member.memberId],
      name: "MemberMessages_memberId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

// --- Ticket system ---

export const ticket = pgTable(
  "Ticket",
  {
    id: serial().primaryKey().notNull(),
    guildId: text().notNull(),
    channelId: text().notNull(),
    openerId: text().notNull(),
    category: text().default("support").notNull(),
    status: text().default("open").notNull(), // open | closed
    claimedBy: text(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    closedAt: timestamp({ precision: 3, mode: "string" }),
  },
  (table) => [
    uniqueIndex("Ticket_channelId_key").using(
      "btree",
      table.channelId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const ticketMessage = pgTable(
  "TicketMessage",
  {
    id: serial().primaryKey().notNull(),
    ticketId: integer().notNull(),
    authorId: text().notNull(),
    authorTag: text().notNull(),
    content: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("TicketMessage_ticketId_idx").using(
      "btree",
      table.ticketId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.ticketId],
      foreignColumns: [ticket.id],
      name: "TicketMessage_ticketId_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
  ],
);

// --- Bug report forum ---

export const bugReport = pgTable(
  "BugReport",
  {
    id: serial().primaryKey().notNull(),
    guildId: text().notNull(),
    forumThreadId: text().notNull(),
    reporterId: text().notNull(),
    status: text().default("open").notNull(), // open | approved | rejected
    rewardedQuota: integer().default(0).notNull(),
    resolvedBy: text(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    resolvedAt: timestamp({ precision: 3, mode: "string" }),
  },
  (table) => [
    uniqueIndex("BugReport_forumThreadId_key").using(
      "btree",
      table.forumThreadId.asc().nullsLast().op("text_ops"),
    ),
  ],
);

// --- Grant audit log (repeatable, not an idempotency lock) ---

export const grantLog = pgTable(
  "GrantLog",
  {
    id: serial().primaryKey().notNull(),
    targetDiscordId: text().notNull(),
    newApiUserId: integer(),
    quota: integer().notNull(),
    reason: text().notNull(),
    sourceType: text().notNull(), // command | ticket | bug | boost
    sourceId: text(),
    grantedByDiscordId: text().notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("GrantLog_targetDiscordId_idx").using(
      "btree",
      table.targetDiscordId.asc().nullsLast().op("text_ops"),
    ),
  ],
);
