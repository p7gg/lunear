import { Slot } from "@radix-ui/react-slot";
import type { LoaderFunctionArgs } from "@remix-run/node";
import {
	Form,
	Link,
	NavLink,
	Outlet,
	type UIMatch,
	useFetcher,
	useLocation,
	useMatches,
	useSubmit,
} from "@remix-run/react";
import { forwardRef, useRef } from "react";
import { z } from "zod";
import { useRequestInfo } from "~/components/client-hints";
import { Icon, type IconName } from "~/components/icons/icons";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
} from "~/components/ui/breadcrumb";
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
import { VisuallyHidden } from "~/components/ui/visually-hidden";
import { APP_NAME, cx } from "~/modules/shared/utils";
import { requireAuth } from "~/modules/shared/utils.server";
import {
	type Action as ThemeAction,
	useOptimisticThemeMode,
} from "~/routes/resources+/theme-switch";

export async function loader({ context }: LoaderFunctionArgs) {
	requireAuth(context);

	return null;
}

const LINKS: Array<{ icon: IconName; path: string; label: string }> = [
	{ icon: "house", label: "Home", path: "/app" },
];

export default function Route() {
	return (
		<div className="min-h-dvh flex w-full flex-col bg-muted/40">
			<aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
				<nav className="flex flex-col items-center gap-4 px-2 sm:py-4">
					<HomeLink />

					{LINKS.map((l) => (
						<Tooltip key={l.path}>
							<TooltipTrigger asChild>
								<NavItem asChild>
									<NavLink end prefetch="intent" to={l.path}>
										<Icon name={l.icon} className="h-5 w-5">
											<span className="sr-only">{l.label}</span>
										</Icon>
									</NavLink>
								</NavItem>
							</TooltipTrigger>
							<TooltipContent side="right">{l.label}</TooltipContent>
						</Tooltip>
					))}
				</nav>
			</aside>

			<div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
				<header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
					<Sheet>
						<SheetTrigger asChild>
							<Button size="icon" variant="outline" className="sm:hidden">
								<Icon name="panel-left" className="h-5 w-5" />
								<span className="sr-only">Toggle Menu</span>
							</Button>
						</SheetTrigger>

						<SheetContent side="left" className="sm:max-w-xs">
							<VisuallyHidden asChild>
								<SheetTitle className="sr-only">{APP_NAME} app</SheetTitle>
							</VisuallyHidden>
							<VisuallyHidden asChild>
								<SheetDescription>Navigation</SheetDescription>
							</VisuallyHidden>

							<nav className="grid gap-6 text-lg font-medium">
								<HomeLink />
							</nav>
						</SheetContent>
					</Sheet>

					<Breadcrumbs />

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="secondary"
								size="icon"
								className="rounded-full ml-auto"
							>
								<Icon name="user" size="lg">
									<span className="sr-only">Toggle user menu</span>
								</Icon>
							</Button>
						</DropdownMenuTrigger>

						<DropdownMenuContent align="end">
							<ThemeItems />
							<DropdownMenuSeparator />
							<SignOutItem />
						</DropdownMenuContent>
					</DropdownMenu>
				</header>

				<main className="flex-1 items-start p-4 sm:px-6 sm:py-0">
					<Outlet />
				</main>
			</div>
		</div>
	);
}

const MatchSchema = z.object({
	breadcrumb: z.function().args(z.custom<UIMatch>()).returns(z.string()),
});

function Breadcrumbs() {
	const matches = useMatches();
	const location = useLocation();

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{matches.map((match) => {
					if (match.handle) {
						const parse = MatchSchema.safeParse(match.handle);

						if (parse.success) {
							const trimmedPath = match.pathname.replace(/\/$/, "");
							const label = parse.data.breadcrumb(match);

							return (
								<BreadcrumbItem key={match.id}>
									{trimmedPath === location.pathname ? (
										<BreadcrumbPage>{label}</BreadcrumbPage>
									) : (
										<BreadcrumbLink asChild>
											<Link to={trimmedPath}>{label}</Link>
										</BreadcrumbLink>
									)}
								</BreadcrumbItem>
							);
						}
					}

					return null;
				})}
			</BreadcrumbList>
		</Breadcrumb>
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
			// this prevents the menu from closing before the form submission is completed
			onSelect={(event) => {
				event.preventDefault();
				submit(formRef.current);
			}}
		>
			<Form action="/sign-out" method="POST" ref={formRef}>
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
			className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
		>
			<Icon name="lunear" className="transition-all group-hover:scale-110">
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
