import { DrizzleSQLiteAdapter } from "@lucia-auth/adapter-drizzle";
import { Lucia } from "lucia";
import { db } from "./db.server";
import { type SelectUser, Session, User } from "./db.server/schema";

const adapter = new DrizzleSQLiteAdapter(db, Session, User);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: process.env.NODE_ENV === "production",
		},
	},
	getUserAttributes: (user) => {
		return {
			userName: user.userName,
			firstName: user.firstName,
			lastName: user.lastName,
		};
	},
});

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: SelectUser;
	}
}
