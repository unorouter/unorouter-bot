import { db } from "@/lib/db";
import { memberRole, memberMessages } from "@/lib/db-schema";
import { and, count, eq, ne } from "drizzle-orm";
import { LEVEL_LIST } from "@/shared/config/levels";
import { JAIL, LEVEL_ROLES, STATUS_ROLES, VOICE_ONLY } from "@/shared/config/roles";
import type { UpdateDbRolesArgs } from "@/types";
import { Guild, Role } from "discord.js";

export class RolesService {
  static async updateDbRoles(args: UpdateDbRolesArgs) {
    // check if new role was added
    if (
      (args.oldMember.flags.bitfield === 9 &&
        args.newMember.flags.bitfield === 11) ||
      args.oldMember.pending ||
      args.newMember.pending
    )
      return;

    if (args.newRoles.length > args.oldRoles.length) {
      // Check for restricted roles (JAIL or VOICE_ONLY)
      const jailId = args.guildRoles.find((role) => role.name === JAIL)?.id;
      const voiceOnlyId = args.guildRoles.find(
        (role) => role.name === VOICE_ONLY,
      )?.id;

      const jailDbRole = args.memberDbRoles.find(
        (dbRole) => dbRole.roleId === jailId,
      );
      const voiceOnlyDbRole = args.memberDbRoles.find(
        (dbRole) => dbRole.roleId === voiceOnlyId,
      );

      // If user has JAIL or VOICE_ONLY role, don't add new roles
      if (jailDbRole || voiceOnlyDbRole) return;

      // add or update new role
      const newAddedRole = args.newRoles.filter(
        (role) => !args.oldRoles.includes(role),
      )[0];
      if (!newAddedRole) return;

      const roleData = {
        roleId: newAddedRole.id,
        memberId: args.newMember.id,
        name: newAddedRole.name,
        guildId: args.newMember.guild.id,
      };

      db.insert(memberRole)
        .values(roleData)
        .onConflictDoUpdate({
          target: [memberRole.memberId, memberRole.roleId],
          set: roleData,
        })
        .catch(() => {});
    }
    if (args.newRoles.length < args.oldRoles.length) {
      // get the removed role
      const newRemovedRole = args.oldRoles.find(
        (role) => !args.newRoles.includes(role),
      );

      // if no role was removed return
      if (!newRemovedRole) return;

      // try catch delete removed role from db
      db.delete(memberRole)
        .where(
          and(
            eq(memberRole.memberId, args.newMember.id),
            eq(memberRole.roleId, newRemovedRole.id),
          ),
        )
        .catch(() => {});
    }
  }

  static async updateStatusRoles(args: UpdateDbRolesArgs) {
    // onboarding question bypass
    if (
      (args.oldMember.flags.bitfield === 9 &&
        args.newMember.flags.bitfield === 11) ||
      args.oldMember.pending ||
      args.newMember.pending
    ) {
      // Find restricted roles (JAIL or VOICE_ONLY)
      const restrictedRoleNames = [JAIL, VOICE_ONLY];
      const dbRestrictedRole = args.memberDbRoles.find(
        (dbRole) =>
          dbRole.roleId ===
          args.guildRoles.find((role) =>
            restrictedRoleNames.includes(role.name),
          )?.id,
      );

      if (dbRestrictedRole) {
        const restrictedRoleName = args.guildRoles.find(
          (role) => role.id === dbRestrictedRole.roleId,
        )?.name;

        // Remove all roles except the restricted one
        for (const role of args.newMember.roles.cache.values()) {
          if (role.name === restrictedRoleName) continue;
          await args.newMember.roles.remove(role).catch(() => {});
        }

        // Add restricted role if not on user
        if (
          !args.newMember.roles.cache.some(
            (role) => role.name === restrictedRoleName,
          )
        )
          args.newMember.roles.add(dbRestrictedRole.roleId).catch(() => {});

        db.delete(memberRole).where(
          and(
            eq(memberRole.memberId, args.newMember.id),
            eq(memberRole.guildId, args.newMember.guild.id),
            ne(memberRole.roleId, dbRestrictedRole.roleId),
          ),
        );

        return;
      }

      return;
    }

    // Only run if user has a new role
    if (args.oldRoles.length >= args.newRoles.length) return;

    const newRoles = args.newRoles.map((role) => role.name);
    const oldRoles = args.oldRoles.map((role) => role.name);
    const newAddedRole = newRoles.find((role) => !oldRoles.includes(role))!;

    // Handle JAIL or VOICE_ONLY role addition
    if (newAddedRole === JAIL || newAddedRole === VOICE_ONLY) {
      const restrictedRole = args.newMember.roles.cache.find(
        (role) => role.name === newAddedRole,
      );

      args.newMember.roles.cache.forEach(
        (role) =>
          role.name !== newAddedRole &&
          args.newMember.roles.remove(role).catch(() => {}),
      );

      return await db.delete(memberRole).where(
        and(
          eq(memberRole.memberId, args.newMember.id),
          eq(memberRole.guildId, args.newMember.guild.id),
          ne(memberRole.roleId, restrictedRole?.id ?? ""),
        ),
      );
    }

    // Check if role is a status role; if yes, remove unused status roles
    if (STATUS_ROLES.includes(newAddedRole)) {
      args.newMember.roles.cache.forEach(
        (role) =>
          newAddedRole !== role.name &&
          STATUS_ROLES.includes(role.name) &&
          args.newMember.roles.remove(role),
      );
    }

    // Check if level roles are added - block self-assigning a level above earned message count
    if (LEVEL_ROLES.includes(newAddedRole)) {
      const levelRole = LEVEL_LIST.find((role) => role.role === newAddedRole);
      if (!levelRole) return;

      const [result] = await db
        .select({ count: count() })
        .from(memberMessages)
        .where(
          and(
            eq(memberMessages.memberId, args.newMember?.id),
            eq(memberMessages.guildId, args.newMember?.guild?.id),
          ),
        );

      const memberMessagesCount = result?.count ?? 0;
      const role = args.newMember.guild.roles.cache.find(
        (role) => role.name === newAddedRole,
      );
      if (memberMessagesCount < levelRole.count && role) {
        args.newMember.roles.remove(role);
      }
    }
  }

  static getGuildStatusRoles(guild: Guild) {
    const guildStatusRoles: { [x: string]: Role | undefined } = {};
    for (const role of STATUS_ROLES)
      guildStatusRoles[role] = guild?.roles.cache.find(
        ({ name }) => name === role,
      );
    return guildStatusRoles;
  }
}
