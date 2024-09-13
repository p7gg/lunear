import type * as React from "react";
import { type VariantProps, cva, cx } from "~/modules/shared/utils";

const badgeVariants = cva({
	base: "inline-flex items-center rounded-md border  font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
	variants: {
		variant: {
			default:
				"border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
			secondary:
				"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
			error:
				"border-transparent bg-error text-error-foreground shadow hover:bg-error/80",
			success:
				"border-transparent bg-success text-success-foreground shadow hover:bg-success/80",
			info: "border-transparent bg-info text-info-foreground shadow hover:bg-info/80",
			warning:
				"border-transparent bg-warning text-warning-foreground shadow hover:bg-warning/80",
			outline: "text-foreground",
		},
		size: {
			sm: "px-1.5 text-xs",
			md: "px-2.5 py-0.5 text-xs",
			lg: "px-3 py-1 text-sm",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "md",
	},
});

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
	return (
		<div
			className={cx(badgeVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
