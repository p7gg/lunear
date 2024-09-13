import type { RequestHandler } from "express";
import { verifyRequestOrigin } from "lucia";

export function csrf(): RequestHandler {
	return async (req, res, next) => {
		if (req.method === "GET") {
			return next();
		}
		const originHeader = req.headers.origin ?? null;
		// NOTE: You may need to use `X-Forwarded-Host` instead
		const hostHeader = req.headers.host ?? null;
		if (
			!originHeader ||
			!hostHeader ||
			!verifyRequestOrigin(originHeader, [hostHeader])
		) {
			return res.status(403).end();
		}
		return next();
	};
}
