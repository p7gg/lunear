import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { title } from "~/modules/shared/utils";

export const meta: MetaFunction = () => {
	return [{ title: title() }];
};

type Loader = typeof loader;
export function loader({ context: { session, user } }: LoaderFunctionArgs) {
	const isSignedIn = !!session || !!user;

	return json({ isSignedIn });
}

export default function Index() {
	const { isSignedIn } = useLoaderData<Loader>();

	return (
		<div className="p-4 flex items-center gap-2">
			{isSignedIn ? (
				<Button asChild>
					<Link to="/app">App</Link>
				</Button>
			) : (
				<>
					<Button asChild>
						<Link to="/sign-in">Sign in</Link>
					</Button>

					<Button asChild>
						<Link to="/sign-up">Sign up</Link>
					</Button>
				</>
			)}
		</div>
	);
}
