import { type Submission, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { getHintUtils } from "@epic-web/client-hints";
import { clientHint as colorSchemeHint } from "@epic-web/client-hints/color-scheme";
import { clientHint as timeZoneHint } from "@epic-web/client-hints/time-zone";
import { invariant } from "@epic-web/invariant";
import { useRouteLoaderData } from "@remix-run/react";
import { defineConfig } from "cva";
import { useCallback, useRef } from "react";
import { twMerge } from "tailwind-merge";
import type { ValueOf } from "type-fest";
import type { z } from "zod";
import type { IconName } from "~/components/icons";
import type { Loader as RootLoader } from "~/root";

export type { VariantProps } from "cva";

export const { cva, cx, compose } = defineConfig({
	hooks: {
		onComplete: (className) => twMerge(className),
	},
});

export type AppName = typeof APP_NAME;
export const APP_NAME = "Lunear";

export function title(): AppName;
export function title<const T extends string>(
	title: T,
): `${typeof title} | ${AppName}`;
export function title<const T extends string>(
	title?: T,
): `${T} | ${AppName}` | AppName;
export function title<const T extends string>(title?: T) {
	if (!title) return APP_NAME;

	return `${title} | ${APP_NAME}`;
}

type BaseUseFormOptions<
	TSchema extends z.ZodType,
	TFormError = Array<string>,
> = Parameters<
	typeof useForm<TSchema["_input"], TSchema["_output"], TFormError>
>[0];
interface UseZodFormOptions<
	TSchema extends z.ZodType,
	TFormError = Array<string>,
> extends Omit<BaseUseFormOptions<TSchema, TFormError>, "onValidate"> {
	schema: TSchema;
}
export function useZodForm<
	TSchema extends z.ZodType,
	TFormError = Array<string>,
>({ schema, ...props }: UseZodFormOptions<TSchema, TFormError>) {
	return useForm({
		shouldValidate: "onSubmit",
		shouldRevalidate: "onInput",
		constraint: getZodConstraint(schema),
		onValidate: ({ formData }) =>
			parseWithZod(formData, { schema }) as Submission<
				TSchema["_input"],
				TFormError,
				TSchema["_output"]
			>,
		...props,
	});
}

type Config<T extends number> = Record<
	T,
	{ label: string; icon: IconName; color?: string }
>;

export enum IssueStatus {
	Canceled = 0,
	Backlog = 1,
	ToDo = 2,
	InProgress = 3,
	Done = 4,
}
export const ISSUE_STATUS_CONFIG = {
	[IssueStatus.Canceled]: {
		label: "Canceled",
		icon: "circle-x",
		color: "text-muted-foreground",
	},
	[IssueStatus.Backlog]: {
		label: "Backlog",
		icon: "circle-dashed",
		color: "text-muted-foreground",
	},
	[IssueStatus.ToDo]: { label: "To-Do", icon: "circle" },
	[IssueStatus.InProgress]: {
		label: "In-Progress",
		icon: "circle-progress",
		color: "text-warning",
	},
	[IssueStatus.Done]: {
		label: "Done",
		icon: "circle-check",
		color: "text-info",
	},
} as const satisfies Config<IssueStatus>;

export enum IssuePriority {
	None = 0,
	Low = 1,
	Medium = 2,
	High = 3,
	Urgent = 4,
}
export const ISSUE_PRIORITY_CONFIG = {
	[IssuePriority.None]: { label: "None", icon: "ellipsis-horizontal" },
	[IssuePriority.Low]: { label: "Low", icon: "signal-low" },
	[IssuePriority.Medium]: { label: "Medium", icon: "signal-medium" },
	[IssuePriority.High]: { label: "High", icon: "signal-high" },
	[IssuePriority.Urgent]: { label: "Urgent", icon: "box-info" },
} as const satisfies Config<IssuePriority>;

export type Role = ValueOf<typeof PROJECT_ROLES>;
export const PROJECT_ROLES = {
	Admin: "ADMIN",
	Member: "MEMBER",
} as const;

export const { getHints, getClientHintCheckScript } = getHintUtils({
	theme: colorSchemeHint,
	timeZone: timeZoneHint,
	// add other hints here
});

export function useRequestInfo() {
	const data = useRouteLoaderData<RootLoader>("root");
	invariant(data?.requestInfo, "No requestInfo found in root loader");

	return data.requestInfo;
}

export function useHints() {
	const requestInfo = useRequestInfo();
	return requestInfo.hints;
}

export function useDebouncedCallback<T extends Array<unknown> = Array<unknown>>(
	func: (...args: T) => void,
	wait: number,
) {
	const timeout = useRef<Timer>();

	return useCallback(
		(...args: T) => {
			const later = () => {
				clearTimeout(timeout.current);
				func(...args);
			};

			clearTimeout(timeout.current);
			timeout.current = setTimeout(later, wait);
		},
		[func, wait],
	);
}

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
