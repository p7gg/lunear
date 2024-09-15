import { parseWithZod } from "@conform-to/zod";
import { invariantResponse } from "@epic-web/invariant";
import { type ActionFunctionArgs, redirect } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetchers } from "@remix-run/react";
import { z } from "zod";
import { useHints, useRequestInfo } from "~/modules/shared/utils";
import { setTheme } from "~/modules/shared/utils.server";

export const ThemeFormSchema = z.object({
	theme: z.enum(["system", "light", "dark"]),
	redirectTo: z.string().optional(),
});

export type Action = typeof action;
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData();
	const submission = parseWithZod(formData, {
		schema: ThemeFormSchema,
	});

	invariantResponse(submission.status === "success", "Invalid theme received");

	const { theme, redirectTo } = submission.value;

	const responseInit = {
		headers: { "set-cookie": setTheme(theme) },
	};
	if (redirectTo) {
		return redirect(redirectTo, responseInit);
	}

	return json({ result: submission.reply() }, responseInit);
}

export function useOptimisticThemeMode() {
	const fetchers = useFetchers();
	const themeFetcher = fetchers.find(
		(f) => f.formAction === "/resources/theme-switch",
	);

	if (themeFetcher?.formData) {
		const submission = parseWithZod(themeFetcher.formData, {
			schema: ThemeFormSchema,
		});

		if (submission.status === "success") {
			return submission.value.theme;
		}
	}
}

export function useTheme() {
	const hints = useHints();
	const requestInfo = useRequestInfo();
	const optimisticMode = useOptimisticThemeMode();
	if (optimisticMode) {
		return optimisticMode === "system" ? hints.theme : optimisticMode;
	}
	return requestInfo.userPrefs.theme ?? hints.theme;
}
