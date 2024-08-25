import { defineConfig } from "cva";
import { twMerge } from "tailwind-merge";

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
export function title<const T extends string>(title?: T) {
	if (!title) return APP_NAME;

	return `${title} | ${APP_NAME}`;
}
