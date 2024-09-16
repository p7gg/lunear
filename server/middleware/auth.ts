import type { RequestHandler } from "express";
import { lucia } from "~/modules/auth.server";

export function auth(): RequestHandler {
	return async (req, res, next) => {
		const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");
		if (!sessionId) {
			res.locals.user = null;
			res.locals.session = null;
			return next();
		}

		const { session, user } = await lucia.validateSession(sessionId);
		res.locals.user = user;
		res.locals.session = session;
		return next();
	};
}
