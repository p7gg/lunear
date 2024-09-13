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
import { createUser } from "~/modules/queries.server";
import { title } from "~/modules/shared/utils";

export const meta: MetaFunction = () => {
	return [{ title: title("Sign in") }];
};

const FormSchema = z
	.object({
		userName: z.string(),
		password: z.string(),
		confirmPassword: z.string(),
		firstName: z.string(),
		lastName: z.string(),
	})
	.refine((values) => values.password === values.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passwords don't match",
	});

type Action = typeof action;
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const submission = parseWithZod(formData, { schema: FormSchema });

	if (submission.status !== "success") {
		return submission.reply();
	}

	const [user, error] = await createUser(submission.value);

	if (error) {
		return jsonWithError(null, {
			message: error.message,
		});
	}

	const session = await lucia.createSession(user.id, {});
	const sessionCookie = lucia.createSessionCookie(session.id);

	throw redirect("/", {
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

	const isSigninUp = navigation.state !== "idle";

	return (
		<div className="h-screen flex items-center justify-center px-4">
			<Card className="mx-auto max-w-sm">
				<CardHeader>
					<CardTitle className="text-xl">Sign Up</CardTitle>
					<CardDescription>
						Enter your information to create an account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form
						method="POST"
						id={form.id}
						onSubmit={form.onSubmit}
						className="flex flex-col gap-4"
					>
						<div className="grid grid-cols-2 gap-4">
							<ConformInput meta={fields.firstName} label="First name" />

							<ConformInput meta={fields.lastName} label="Last name" />
						</div>

						<ConformInput meta={fields.userName} label="Username" />

						<ConformInput
							type="password"
							meta={fields.password}
							label="Password"
						/>

						<ConformInput
							type="password"
							meta={fields.confirmPassword}
							label="Confirm password"
						/>

						<Button type="submit" className="w-full" disabled={isSigninUp}>
							{isSigninUp ? (
								<Icon name="loader-circle" className="animate-spin mr-2" />
							) : null}
							Create an account
						</Button>
					</Form>

					<div className="mt-4 text-center text-sm">
						Already have an account?{" "}
						<Link to="/auth/sign-in" className="underline">
							Sign in
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
