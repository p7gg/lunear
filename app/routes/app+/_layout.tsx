import type { DropdownMenuContentProps } from "@radix-ui/react-dropdown-menu";
import { Slot } from "@radix-ui/react-slot";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
	Form,
	Link,
	NavLink,
	Outlet,
	useFetcher,
	useSubmit,
} from "@remix-run/react";
import { forwardRef, useRef } from "react";
import { Icon, type IconName } from "~/components/icons/icons";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { APP_NAME, cx, useRequestInfo } from "~/modules/shared/utils";
import { requireAuth } from "~/modules/shared/utils.server";
import { useUser } from "~/modules/user";
import {
	type Action as ThemeAction,
	useOptimisticThemeMode,
} from "~/routes/resources+/theme-switch";

export async function loader({ context }: LoaderFunctionArgs) {
	requireAuth(context);

	return null;
}

const LINKS: Array<{
	icon: IconName;
	path: string;
	label: string;
	end?: true;
}> = [
	{ icon: "house", label: "Home", path: "/app", end: true },
	{ icon: "folder", label: "Projects", path: "/app/projects" },
	{ icon: "tickets", label: "Issues", path: "/app/issues" },
];

export default function Route() {
	return (
		<div className="bg-muted/40">
			<aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col flex-1 border-r bg-background sm:flex sm:items-center px-2 sm:py-4">
				<nav className="flex flex-col items-center gap-4">
					<HomeLink />

					{LINKS.map((l) => (
						<Tooltip key={l.path}>
							<TooltipTrigger asChild>
								<NavItem asChild>
									<NavLink prefetch="intent" to={l.path} end={l.end}>
										<Icon name={l.icon} size="sm">
											<span className="sr-only">{l.label}</span>
										</Icon>
									</NavLink>
								</NavItem>
							</TooltipTrigger>
							<TooltipContent side="right">{l.label}</TooltipContent>
						</Tooltip>
					))}
				</nav>

				<UserDropdown side="right" align="end" />
			</aside>

			<div className="flex flex-col sm:gap-4 sm:pl-14 min-h-dvh">
				<header className="sticky top-0 z-30 flex sm:hidden h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
					<Sheet>
						<SheetTrigger asChild>
							<Button size="icon" variant="outline">
								<Icon name="panel-left" className="h-5 w-5" />
								<span className="sr-only">Toggle Menu</span>
							</Button>
						</SheetTrigger>

						<SheetContent side="left" className="sm:max-w-xs">
							<SheetTitle className="sr-only">{APP_NAME} app</SheetTitle>
							<SheetDescription className="sr-only">
								Navigation
							</SheetDescription>

							<nav className="grid gap-6 text-lg font-medium">
								<HomeLink />
							</nav>
						</SheetContent>
					</Sheet>
				</header>

				<Outlet />
			</div>
		</div>
	);
}

function UserDropdown(props: {
	side?: DropdownMenuContentProps["side"];
	align?: DropdownMenuContentProps["align"];
}) {
	const user = useUser();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Avatar asChild>
					<Button
						variant="secondary"
						size="icon"
						className="rounded-full mt-auto"
					>
						<AvatarFallback>
							{user.firstName.charAt(0)}
							{user.lastName.charAt(0)}
						</AvatarFallback>
					</Button>
				</Avatar>
			</DropdownMenuTrigger>

			<DropdownMenuContent align={props.align} side={props.side}>
				<ThemeItems />
				<DropdownMenuSeparator />
				<SignOutItem />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ThemeItems() {
	const fetcher = useFetcher<ThemeAction>();

	const optimisticTheme = useOptimisticThemeMode();
	const requestInfo = useRequestInfo();

	const theme = optimisticTheme ?? requestInfo.userPrefs.theme ?? "system";

	return (
		<>
			<DropdownMenuLabel>Theme</DropdownMenuLabel>
			<DropdownMenuSeparator />
			<DropdownMenuRadioGroup
				asChild
				value={theme}
				onValueChange={(theme) => {
					const formData = new FormData();
					formData.set("theme", theme);
					fetcher.submit(formData, {
						method: "POST",
						action: "/resources/theme-switch",
					});
				}}
			>
				<fetcher.Form method="POST" action="/resources/theme-switch">
					<DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
				</fetcher.Form>
			</DropdownMenuRadioGroup>
		</>
	);
}

function SignOutItem() {
	const submit = useSubmit();
	const formRef = useRef<HTMLFormElement>(null);

	return (
		<DropdownMenuItem
			asChild
			onSelect={(event) => {
				event.preventDefault();
				submit(formRef.current);
			}}
		>
			<Form action="/auth/sign-out" method="POST" ref={formRef}>
				<Icon className="text-body-md" name="log-out">
					<button type="submit">Sign out</button>
				</Icon>
			</Form>
		</DropdownMenuItem>
	);
}

function HomeLink() {
	return (
		<Link
			prefetch="intent"
			to="/"
			className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#131316] text-[#f4f4f4] border"
		>
			<Icon
				name="lunear"
				size="xl"
				className="transition-transform group-hover:scale-110"
			>
				<span className="sr-only">Lunear app</span>
			</Icon>
		</Link>
	);
}

interface NavItem extends React.ComponentProps<"button"> {
	asChild?: true;
}
const NavItem: React.FC<NavItem> = forwardRef(
	({ asChild, className, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";

		return (
			<Comp
				ref={ref}
				{...props}
				className={cx(
					"flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8  aria-current:bg-accent aria-current:text-accent-foreground",
					className,
				)}
			/>
		);
	},
);
