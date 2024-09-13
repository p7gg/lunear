import { type AppLoadContext, redirect } from "@remix-run/node";
import { parseAcceptLanguage } from "intl-parse-accept-language";
import { parseCookies, serializeCookie } from "oslo/cookie";
import type { SetNonNullable } from "type-fest";
import { getHints } from "./utils";

const cookieName = "en_theme";
export type Theme = "light" | "dark";

export function getTheme(request: Request): Theme | null {
	const cookieHeader = request.headers.get("cookie");
	const parsed = cookieHeader
		? parseCookies(cookieHeader).get(cookieName)
		: "light";
	if (parsed === "light" || parsed === "dark") return parsed;
	return null;
}

export function setTheme(theme: Theme | "system") {
	if (theme === "system") {
		return serializeCookie(cookieName, "", { path: "/", maxAge: -1 });
	}

	return serializeCookie(cookieName, theme, { path: "/", maxAge: 31536000 });
}

export type AuthenticatedContext = SetNonNullable<
	AppLoadContext,
	"user" | "session"
>;
export function requireAuth(
	ctx: AppLoadContext,
): asserts ctx is AuthenticatedContext {
	if (!ctx.session || !ctx.user) {
		throw redirect("/auth/sign-in");
	}
}

export function getDateTimeFormat(
	request: Request,
	options?: Intl.DateTimeFormatOptions,
) {
	const [locale = "en-US"] = parseAcceptLanguage(
		request.headers.get("accept-language"),
		{ validate: Intl.DateTimeFormat.supportedLocalesOf },
	);
	const timeZone = getHints(request).timeZone ?? "UTC";

	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		timeZone,
	};
	const mergedOptions = { ...defaultOptions, ...options };
	return new Intl.DateTimeFormat(locale, mergedOptions);
}

type SafeQueryResult<T extends Promise<unknown>> =
	| [data: Awaited<T>, error: null]
	| [data: null, error: Error];
export async function safeQuery<P extends Promise<unknown>>(
	promise: P,
): Promise<SafeQueryResult<P>> {
	try {
		return [await promise, null];
	} catch (error) {
		if (error instanceof Error) {
			return [null, error];
		}

		throw error;
	}
}

export function notFound() {
	return new Response("Not Found", { status: 404, statusText: "Not Found" });
}

export function badRequest(body: string) {
	return new Response(body, {
		status: 400,
		statusText: "Bad Request",
	});
}

export function unauthorized(body = "Unauthorized") {
	return new Response(body, {
		status: 401,
		statusText: "Unauthorized",
	});
}
