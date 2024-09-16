import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { useRef, useState } from "react";
import { LoaderBar } from "~/components/global-pending-indicator";
import { Icon } from "~/components/icons";
import { Button, type ButtonProps } from "~/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { db } from "~/modules/db.server";
import { Project, ProjectMember } from "~/modules/db.server/schema";
import { cx, useDebouncedCallback } from "~/modules/shared/utils";
import { requireAuth } from "~/modules/shared/utils.server";

const projectsQuery = db
	.select({ id: Project.id, name: Project.name })
	.from(Project)
	.innerJoin(ProjectMember, eq(Project.id, ProjectMember.projectId))
	.where(
		and(
			eq(ProjectMember.userId, sql.placeholder("userId")),
			like(Project.name, sql.placeholder("q")),
		),
	)
	.orderBy(desc(Project.createdAt))
	.limit(5)
	.prepare();

export type Loader = typeof loader;
export async function loader({ context, request }: LoaderFunctionArgs) {
	requireAuth(context);

	const url = new URL(request.url);
	const q = url.searchParams.get("q");

	return json(
		q ? await projectsQuery.all({ q: `%${q}%`, userId: context.user.id }) : [],
	);
}

export function ProjectCombobox(props: {
	variant?: ButtonProps["variant"];
	className?: string;

	value: string | null;
	onValueChange?: (projectId: string) => void;
	initialValues?: Array<{ id: string; name: string }>;
	disabled?: boolean;
}) {
	const fetcher = useFetcher<Loader>();

	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);

	const handleSearch = useDebouncedCallback(() => {
		fetcher.submit(formRef.current);
	}, 400);

	const map = new Map(props.initialValues?.map((p) => [p.id, p]));

	if (fetcher.data) {
		for (const data of fetcher.data) {
			!map.has(data.id) && map.set(data.id, data);
		}
	}

	const options = [...map.values()];

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					role="combobox"
					variant={props.variant ?? "outline"}
					disabled={props.disabled}
					aria-expanded={open}
					className={cx(
						"w-48 justify-between peer-aria-invalid:border-error",
						props.className,
					)}
				>
					{props.value
						? options.find((p) => p.id === props.value)?.name
						: "Select a project..."}
					<Icon name="chevrons-up-down" className="ml-2 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-popover p-0 relative overflow-hidden">
				<LoaderBar
					className={fetcher.state === "idle" ? "hidden" : undefined}
				/>

				<Command>
					<fetcher.Form
						ref={formRef}
						method="GET"
						action="/resources/filter-projects"
					>
						<CommandInput
							name="q"
							placeholder="Search Project..."
							onValueChange={handleSearch}
						/>
					</fetcher.Form>

					<CommandList>
						<CommandEmpty>No project found.</CommandEmpty>
						<CommandGroup>
							{options.map((option) => (
								<CommandItem
									key={option.id}
									value={option.id}
									keywords={[option.name]}
									onSelect={(currentValue) => {
										props.onValueChange?.(currentValue);
										setOpen(false);
									}}
								>
									<Icon
										name="check"
										className={cx(
											"mr-2",
											props.value === option.id ? "opacity-100" : "opacity-0",
										)}
									/>
									{option.name}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
