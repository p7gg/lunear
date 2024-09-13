import { parseArgs } from "node:util";
import { invariant } from "@epic-web/invariant";
import { type Config, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_CONNECTION_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const { values } = parseArgs({
	args: Bun.argv,
	options: {
		db: {
			type: "string",
			default: "local-replica" satisfies keyof typeof DB_CONNECTION_DICT,
		},
	},
	strict: true,
	allowPositionals: true,
});

invariant(values.db, "Missing DB connection mode");
invariant(url, "Missing TURSO_CONNECTION_URL");

const DB_CONNECTION_DICT: Record<string, Config> = {
	local: {
		url: "file:local.sqlite",
	},
	"local-replica": {
		url: "file:local.sqlite",
		syncUrl: url,
		authToken,
		syncInterval: 60,
	},
	remote: {
		url,
		authToken,
	},
};

export const client = createClient(DB_CONNECTION_DICT[values.db]);

if (values.db === "local-replica") {
	client.sync();
}

export const db = drizzle(client, {
	schema,
	logger: process.env.NODE_ENV !== "production",
});

process.on("exit", () => {
	client.close();
});
