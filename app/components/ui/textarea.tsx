import { type FieldMetadata, getTextareaProps } from "@conform-to/react";
import * as React from "react";
import { cx } from "~/modules/shared/utils";
import { Label } from "./label";

export interface TextareaProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cx(
					"flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground",
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
Textarea.displayName = "Textarea";

type ConformTextareaProps<
	FieldSchema,
	FormSchema extends Record<string, unknown>,
	FormError = Array<string>,
> = {
	meta: FieldMetadata<FieldSchema, FormSchema, FormError>;
	ariaAttributes?: boolean;
	ariaInvalid?: "errors" | "allErrors";
	ariaDescribedBy?: string;
	label?: string;
	description?: string;
	error?: string;
	className?: string;
};
const ConformTextarea = React.forwardRef(
	<
		FieldSchema,
		FormSchema extends Record<string, unknown>,
		FormError extends Array<string>,
	>(
		{
			meta,
			ariaAttributes,
			ariaDescribedBy,
			ariaInvalid,
			label,
			description,
			error,
			className,
		}: ConformTextareaProps<FieldSchema, FormSchema, FormError>,
		ref: React.LegacyRef<HTMLTextAreaElement>,
	) => {
		const [errorMsg] = meta.errors ?? [error];

		const { key, ...textAreaProps } = getTextareaProps(meta, {
			ariaInvalid,
			ariaAttributes,
			ariaDescribedBy,
		});

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
				<Textarea ref={ref} key={key} {...textAreaProps} />
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
ConformTextarea.displayName = "ConformTextarea";

export { Textarea, ConformTextarea };
