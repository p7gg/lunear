import { invariant } from "@epic-web/invariant";
import { useRouteLoaderData } from "@remix-run/react";
import type { Loader as RootLoader } from "~/root";

export function useOptionalUser() {
	const data = useRouteLoaderData<RootLoader>("root");
	if (!data) {
		return null;
	}
	return data.user;
}

export function useUser() {
	const maybeUser = useOptionalUser();
	invariant(
		maybeUser,
		"No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.",
	);

	return maybeUser;
}
