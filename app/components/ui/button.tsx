import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { type VariantProps, cva, cx } from "~/modules/shared/utils";

const buttonVariants = cva({
	base: [
		"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors",
		"disabled:pointer-events-none disabled:opacity-50",
		"focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-ring",
	],
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
			error: "bg-error text-error-foreground shadow-sm hover:bg-error/90",
			success:
				"bg-success text-success-foreground shadow-sm hover:bg-success/90",
			info: "bg-info text-info-foreground shadow-sm hover:bg-info/90",
			warning:
				"bg-warning text-warning-foreground shadow-sm hover:bg-warning/90",
			outline:
				"border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
			secondary:
				"bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			link: "text-primary underline-offset-4 hover:underline",
		},
		size: {
			default: "h-9 px-4 py-2",
			sm: "h-8 rounded-md px-3 text-xs",
			lg: "h-10 rounded-md px-8",
			icon: "h-9 w-9",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cx(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

export { Button, buttonVariants };
