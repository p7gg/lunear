import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

const cuid = <T extends string>(name: T) =>
	text(name).primaryKey().$defaultFn(createId);
const _defaultNow = <T extends string>(name: T) =>
	integer(name, { mode: "timestamp" })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`);

export type InsertUser = typeof User.$inferInsert;
export type SelectUser = typeof User.$inferSelect;
export const User = sqliteTable(
	"users",
	{
		id: cuid("id"),
		userName: text("username").notNull().unique(),
		firstName: text("first_name").notNull(),
		lastName: text("last_name").notNull(),
		password: text("password").notNull(),
	},
	(table) => ({
		usernameIdx: uniqueIndex("username_idx").on(table.userName),
	}),
);

export type InsertSession = typeof Session.$inferInsert;
export type SelectSession = typeof Session.$inferSelect;
export const Session = sqliteTable("sessions", {
	id: text("id").notNull().primaryKey(),
	expiresAt: integer("expires_at").notNull(),
	userId: text("user_id")
		.references(() => User.id)
		.notNull(),
});
