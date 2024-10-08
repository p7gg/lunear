import { join } from "node:path";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import type { Session, User } from "lucia";
import morgan from "morgan";
import { auth } from "./middleware/auth";

const mode = process.env.NODE_ENV;
const dirname = import.meta.dirname;
const buildDirectory = join(dirname, "../build");

const viteDevServer =
	process.env.NODE_ENV === "production"
		? undefined
		: await import("vite").then((vite) =>
				vite.createServer({ server: { middlewareMode: true } }),
			);

const remixHandler = createRequestHandler({
	build: viteDevServer
		? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
		: await import(join(buildDirectory, "server", "index.js")),
	mode,
	getLoadContext: (_req, res) => ({
		session: res.locals.session,
		user: res.locals.user,
	}),
});

const app = express();

app.use(compression());
app.use(
	morgan("tiny", {
		skip(req) {
			return req.url.startsWith("/node_modules/");
		},
	}),
);
app.use(auth());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// handle asset requests
if (viteDevServer) {
	app.use(viteDevServer.middlewares);
} else {
	// Vite fingerprints its assets so we can cache forever.
	app.use(
		"/assets",
		express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
	);
}

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("build/client", { maxAge: "1h" }));

// handle SSR requests
app.all("*", remixHandler);

const port = 3000;
app.listen(port, () => {
	// biome-ignore lint/suspicious/noConsoleLog: <explanation>
	console.log(`Express server listening at http://localhost:${port}`);
});

interface AppContext {
	user: User | null;
	session: Session | null;
}

declare global {
	namespace Express {
		interface Locals extends AppContext {}
	}
}

declare module "@remix-run/server-runtime" {
	interface AppLoadContext extends AppContext {}
}
