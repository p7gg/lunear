import { Argon2id } from "oslo/password";
import { db } from "./db.server/client";
import { type InsertUser, User } from "./db.server/schema";
import { query } from "./shared/utils.server";

export async function createUser(payload: InsertUser) {
	const hashedPassword = await new Argon2id().hash(payload.password);

	return query(
		db
			.insert(User)
			.values({
				userName: payload.userName,
				password: hashedPassword,
				firstName: payload.firstName,
				lastName: payload.lastName,
			})
			.returning({ id: User.id })
			.then(([user]) => user),
	);
}

export async function getUserByUserName(userName: string) {
	return query(
		db.query.User.findFirst({
			where: (table, { eq }) => eq(table.userName, userName),
		}),
	);
}
