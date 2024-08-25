import { invariant } from "@epic-web/invariant";
import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

invariant(url, "Missing TURSO_CONNECTION_URL");

export default defineConfig({
	schema: "./app/modules/db.server/schema.ts",
	out: "./drizzle/migrations",
	dialect: "sqlite",
	driver: "turso",
	dbCredentials: {
		url,
		authToken,
	},
});
