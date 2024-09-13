import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import {
	type ActionFunctionArgs,
	type MetaFunction,
	redirect,
} from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { jsonWithError } from "remix-toast";
import { z } from "zod";
import { Icon } from "~/components/icons/icons";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { ConformInput } from "~/components/ui/input";
import { lucia } from "~/modules/auth.server";
import { getUserByUserName } from "~/modules/queries.server";
import { title } from "~/modules/shared/utils";

export const meta: MetaFunction = () => {
	return [{ title: title("Sign in") }];
};

const FormSchema = z.object({
	userName: z.string(),
	password: z.string(),
});

type Action = typeof action;
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const submission = parseWithZod(formData, { schema: FormSchema });

	if (submission.status !== "success") {
		return submission.reply();
	}

	const [user, error] = await getUserByUserName(submission.value.userName);

	if (error) {
		return jsonWithError(null, {
			message: error.message,
		});
	}

	if (!user) {
		return jsonWithError(null, {
			message: "Incorrect username or password",
		});
	}

	const isValidPassword = await Bun.password.verify(
		submission.value.password,
		user.password,
	);

	if (!isValidPassword) {
		return jsonWithError(null, {
			message: "Incorrect username or password",
		});
	}

	const session = await lucia.createSession(user.id, {});
	const sessionCookie = lucia.createSessionCookie(session.id);

	throw redirect("/app", {
		headers: {
			"Set-Cookie": sessionCookie.serialize(),
		},
	});
}

export default function Route() {
	const lastResult = useActionData<Action>();
	const navigation = useNavigation();

	const [form, fields] = useForm({
		lastResult,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: FormSchema });
		},
	});

	const isSigninIn = navigation.state !== "idle";

	return (
		<div className="h-screen flex items-center justify-center px-4">
			<Card className="mx-auto max-w-sm">
				<CardHeader>
					<CardTitle className="text-2xl">Login</CardTitle>
					<CardDescription>
						Enter your username below to login to your account
					</CardDescription>
				</CardHeader>

				<CardContent>
					<Form
						method="POST"
						id={form.id}
						className="flex flex-col gap-4"
						onSubmit={form.onSubmit}
					>
						<ConformInput meta={fields.userName} label="Username" />

						<ConformInput
							type="password"
							meta={fields.password}
							label="Password"
						/>

						<Button type="submit" className="w-full" disabled={isSigninIn}>
							{isSigninIn ? (
								<Icon name="loader-circle" className="animate-spin mr-2" />
							) : null}
							Login
						</Button>
					</Form>

					<div className="mt-4 text-center text-sm">
						Don&apos;t have an account?{" "}
						<Link to="/auth/sign-up" className="underline">
							Sign up
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
