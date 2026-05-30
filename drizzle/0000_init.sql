CREATE TABLE "BugReport" (
	"id" serial PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL,
	"forumThreadId" text NOT NULL,
	"reporterId" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"rewardedQuota" integer DEFAULT 0 NOT NULL,
	"resolvedBy" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"resolvedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "GrantLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"targetDiscordId" text NOT NULL,
	"unorouterUserId" integer,
	"quota" integer NOT NULL,
	"reason" text NOT NULL,
	"sourceType" text NOT NULL,
	"sourceId" text,
	"grantedByDiscordId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Guild" (
	"guildId" text PRIMARY KEY NOT NULL,
	"guildName" text NOT NULL,
	"lookback" integer DEFAULT 9999 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Member" (
	"memberId" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"globalName" text,
	"createdAt" timestamp(3),
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"avatarUrl" text,
	"bannerUrl" text,
	"bot" boolean DEFAULT false NOT NULL,
	"flags" bigint,
	"system" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MemberGuild" (
	"id" serial PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"status" boolean DEFAULT true NOT NULL,
	"nickname" text,
	"displayName" text,
	"warnings" integer DEFAULT 0 NOT NULL,
	"joinedAt" timestamp(3),
	"premiumSince" timestamp(3),
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MemberMessages" (
	"id" text PRIMARY KEY NOT NULL,
	"memberId" text NOT NULL,
	"guildId" text NOT NULL,
	"messageId" text NOT NULL,
	"channelId" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MemberRole" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleId" text NOT NULL,
	"guildId" text NOT NULL,
	"memberId" text NOT NULL,
	"name" text,
	"color" integer,
	"hexColor" text,
	"position" integer,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Ticket" (
	"id" serial PRIMARY KEY NOT NULL,
	"guildId" text NOT NULL,
	"channelId" text NOT NULL,
	"openerId" text NOT NULL,
	"category" text DEFAULT 'support' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"claimedBy" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"closedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "TicketMessage" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"authorId" text NOT NULL,
	"authorTag" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "MemberGuild" ADD CONSTRAINT "MemberGuild_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberGuild" ADD CONSTRAINT "MemberGuild_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberMessages" ADD CONSTRAINT "MemberMessages_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberMessages" ADD CONSTRAINT "MemberMessages_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "public"."Guild"("guildId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MemberRole" ADD CONSTRAINT "MemberRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("memberId") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "BugReport_forumThreadId_key" ON "BugReport" USING btree ("forumThreadId" text_ops);--> statement-breakpoint
CREATE INDEX "GrantLog_targetDiscordId_idx" ON "GrantLog" USING btree ("targetDiscordId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Guild_guildId_key" ON "Guild" USING btree ("guildId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Member_memberId_key" ON "Member" USING btree ("memberId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MemberGuild_memberId_guildId_key" ON "MemberGuild" USING btree ("memberId" text_ops,"guildId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MemberMessages_messageId_key" ON "MemberMessages" USING btree ("messageId" text_ops);--> statement-breakpoint
CREATE INDEX "MemberMessages_memberId_guildId_idx" ON "MemberMessages" USING btree ("memberId" text_ops,"guildId" text_ops);--> statement-breakpoint
CREATE INDEX "MemberRole_memberId_guildId_idx" ON "MemberRole" USING btree ("memberId" text_ops,"guildId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "MemberRole_memberId_roleId_key" ON "MemberRole" USING btree ("memberId" text_ops,"roleId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket" USING btree ("channelId" text_ops);--> statement-breakpoint
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage" USING btree ("ticketId");