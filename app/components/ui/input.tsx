import { type FieldMetadata, getInputProps } from "@conform-to/react";
import * as React from "react";
import { cx } from "~/modules/shared/utils";
import { Label } from "./label";

export interface InputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, ...props }, ref) => {
		return (
			<input
				className={cx(
					"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground",
					"file:border-0 file:bg-transparent file:text-sm file:font-medium",
					"focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-ring",
					"disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				ref={ref}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

type ConformInputProps<
	FieldSchema,
	FormSchema extends Record<string, unknown>,
	FormError = Array<string>,
> = {
	meta: FieldMetadata<FieldSchema, FormSchema, FormError>;
	type?: "color" | "email" | "number" | "password" | "search" | "text";
	ariaAttributes?: boolean;
	ariaInvalid?: "errors" | "allErrors";
	ariaDescribedBy?: string;
	label?: string;
	description?: string;
	error?: string;
	className?: string;
};
const ConformInput = React.forwardRef(
	<
		FieldSchema,
		FormSchema extends Record<string, unknown>,
		FormError extends Array<string>,
	>(
		{
			meta,
			type = "text",
			ariaAttributes,
			ariaDescribedBy,
			ariaInvalid,
			label,
			description,
			error,
			className,
		}: ConformInputProps<FieldSchema, FormSchema, FormError>,
		ref: React.LegacyRef<HTMLInputElement>,
	) => {
		const [errorMsg] = meta.errors ?? [error];

		return (
			<div className={cx("flex flex-col gap-1", className)}>
				{label ? (
					<Label
						htmlFor={meta.id}
						className={errorMsg ? "text-error" : undefined}
					>
						{label}
					</Label>
				) : null}
				<Input
					ref={ref}
					{...getInputProps(meta, {
						type,
						ariaInvalid,
						ariaAttributes,
						ariaDescribedBy,
					})}
				/>
				{description ? (
					<span
						id={meta.descriptionId}
						className="text-sm text-muted-foreground"
					>
						{description}
					</span>
				) : null}
				{errorMsg ? (
					<span id={meta.errorId} className="text-sm font-medium text-error">
						{errorMsg}
					</span>
				) : null}
			</div>
		);
	},
);
ConformInput.displayName = "ConformInput";

export { Input, ConformInput };
