import { type LoaderFunctionArgs, redirect } from "@remix-run/node";

export async function loader({
	context: { session, user },
}: LoaderFunctionArgs) {
	if (session || user) {
		throw redirect("/");
	}

	return null;
}
