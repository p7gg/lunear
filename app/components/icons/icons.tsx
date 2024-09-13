import { cx } from "cva";
import iconsHref from "./icons.svg?url";

export { iconsHref };

export type IconName =
	| "check"
	| "chevron-down"
	| "chevron-first"
	| "chevron-last"
	| "chevron-left"
	| "chevron-right"
	| "chevron-up"
	| "chevrons-down"
	| "chevrons-down-up"
	| "chevrons-left"
	| "chevrons-left-right"
	| "chevrons-left-right-ellipsis"
	| "chevrons-right"
	| "chevrons-right-left"
	| "chevrons-up"
	| "chevrons-up-down"
	| "loader"
	| "loader-circle"
	| "minus"
	| "plus"
	| "x"
	| "trash"
	| "trash-2"
	| "dot-filled"
	| "circle"
	| "user"
	| "user-round"
	| "sun"
	| "moon"
	| "laptop"
	| "log-out"
	| "dots-horizontal"
	| "dots-vertical"
	| "remix"
	| "house"
	| "x"
	| "search"
	| "panel-left"
	| "folder"
	| "folder-git-2"
	| "tickets"
	| "circle-dashed"
	| "circle-progress"
	| "circle-check"
	| "circle-x"
	| "ellipsis-horizontal"
	| "box-info"
	| "signal-high"
	| "signal-medium"
	| "signal-low"
	| "list-filter"
	| "user-plus"
	| "user-minus"
	| "arrow-down-wide-narrow"
	| "bold"
	| "italic"
	| "strikethrough"
	| "heading-1"
	| "heading-2"
	| "heading-3"
	| "heading-4"
	| "heading-5"
	| "heading-6"
	| "align-center"
	| "align-justify"
	| "align-left"
	| "align-right"
	| "pin"
	| "lunear";

const sizeClassName = {
	font: "w-[1em] h-[1em]",
	xs: "w-3 h-3",
	sm: "w-4 h-4",
	md: "w-5 h-5",
	lg: "w-6 h-6",
	xl: "w-7 h-7",
} as const;

type Size = keyof typeof sizeClassName;

const childrenSizeClassName = {
	font: "gap-1.5",
	xs: "gap-1.5",
	sm: "gap-1.5",
	md: "gap-2",
	lg: "gap-2",
	xl: "gap-3",
} satisfies Record<Size, string>;

/**
 * Renders an SVG icon. The icon defaults to the size of the font. To make it
 * align vertically with neighboring text, you can pass the text as a child of
 * the icon and it will be automatically aligned.
 * Alternatively, if you're not ok with the icon being to the left of the text,
 * you need to wrap the icon and text in a common parent and set the parent to
 * display "flex" (or "inline-flex") with "items-center" and a reasonable gap.
 *
 * Pass `title` prop to the `Icon` component to get `<title>` element rendered
 * in the SVG container, providing this way for accessibility.
 */
export function Icon({
	name,
	size = "font",
	className,
	title,
	children,
	...props
}: React.SVGProps<SVGSVGElement> & {
	name: IconName;
	size?: Size;
	title?: string;
}) {
	if (children) {
		return (
			<span
				className={`inline-flex items-center ${childrenSizeClassName[size]}`}
			>
				<Icon
					name={name}
					size={size}
					className={className}
					title={title}
					{...props}
				/>
				{children}
			</span>
		);
	}
	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
		<svg
			{...props}
			className={cx(sizeClassName[size], "inline self-center", className)}
		>
			{title ? <title>{title}</title> : null}
			<use href={`${iconsHref}#${name}`} />
		</svg>
	);
}
