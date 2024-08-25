import { invariant } from "@epic-web/invariant";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

invariant(url, "Missing TURSO_CONNECTION_URL");

const client = createClient({
	url,
	authToken,
});

export const db = drizzle(client, { schema });
