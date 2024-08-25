import { type ActionFunctionArgs, redirect } from "@remix-run/node";
import { lucia } from "~/modules/auth.server";

export async function action({ context }: ActionFunctionArgs) {
	if (!context.session) {
		throw redirect("/sign-in");
	}

	await lucia.invalidateSession(context.session.id);
	const sessionCookie = lucia.createBlankSessionCookie();

	throw redirect("/", {
		headers: {
			"Set-Cookie": sessionCookie.serialize(),
		},
	});
}
