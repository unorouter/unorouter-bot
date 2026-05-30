import { relations } from "drizzle-orm/relations";
import {
  guild,
  member,
  memberGuild,
  memberMessages,
  memberRole,
  ticket,
  ticketMessage,
} from "./schema";

export const guildRelations = relations(guild, ({ many }) => ({
  memberGuilds: many(memberGuild),
  memberRoles: many(memberRole),
  memberMessages: many(memberMessages),
}));

export const memberRelations = relations(member, ({ many }) => ({
  memberGuilds: many(memberGuild),
  memberRoles: many(memberRole),
  memberMessages: many(memberMessages),
}));

export const memberGuildRelations = relations(memberGuild, ({ one }) => ({
  guild: one(guild, {
    fields: [memberGuild.guildId],
    references: [guild.guildId],
  }),
  member: one(member, {
    fields: [memberGuild.memberId],
    references: [member.memberId],
  }),
}));

export const memberRoleRelations = relations(memberRole, ({ one }) => ({
  guild: one(guild, {
    fields: [memberRole.guildId],
    references: [guild.guildId],
  }),
  member: one(member, {
    fields: [memberRole.memberId],
    references: [member.memberId],
  }),
}));

export const memberMessagesRelations = relations(memberMessages, ({ one }) => ({
  guild: one(guild, {
    fields: [memberMessages.guildId],
    references: [guild.guildId],
  }),
  member: one(member, {
    fields: [memberMessages.memberId],
    references: [member.memberId],
  }),
}));

export const ticketRelations = relations(ticket, ({ many }) => ({
  messages: many(ticketMessage),
}));

export const ticketMessageRelations = relations(ticketMessage, ({ one }) => ({
  ticket: one(ticket, {
    fields: [ticketMessage.ticketId],
    references: [ticket.id],
  }),
}));
