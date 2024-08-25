import { type AppLoadContext, redirect } from "@remix-run/node";
import { parseCookies, serializeCookie } from "oslo/cookie";
import type { SetNonNullable } from "type-fest";

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

export function requireUser(
	ctx: AppLoadContext,
): asserts ctx is SetNonNullable<AppLoadContext, "user"> {
	if (!ctx.user) {
		throw redirect("/sign-in");
	}
}
export function requireSession(
	ctx: AppLoadContext,
): asserts ctx is SetNonNullable<AppLoadContext, "session"> {
	if (!ctx.session) {
		throw redirect("/sign-in");
	}
}
export function requireAuth(
	ctx: AppLoadContext,
): asserts ctx is SetNonNullable<AppLoadContext, "user" | "session"> {
	if (!ctx.session || !ctx.user) {
		throw redirect("/sign-in");
	}
}

export async function query<D, P extends Promise<D>>(promise: P) {
	try {
		return { data: await promise, error: null };
	} catch (error) {
		if (error instanceof Error) {
			return { data: null, error };
		}

		throw error;
	}
}
