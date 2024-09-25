import { parseWithZod } from "@conform-to/zod";
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
	type SerializeFrom,
	defer,
	json,
} from "@remix-run/node";
import {
	Await,
	Link,
	useFetcher,
	useFetchers,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react";
import {
	type SQL,
	and,
	asc,
	desc,
	eq,
	inArray,
	notInArray,
	or,
} from "drizzle-orm";
import { Suspense, useRef } from "react";
import { jsonWithError } from "remix-toast";
import { z } from "zod";
import { LoaderBar } from "~/components/global-pending-indicator";
import { Icon } from "~/components/icons";
import { PriorityDropdown } from "~/components/priority-dropdown";
import { StatusDropdown } from "~/components/status-dropdown";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { db } from "~/modules/db.server";
import {
	Issue,
	Project,
	ProjectMember,
	User,
} from "~/modules/db.server/schema";
import {
	createIssue,
	deleteIssueById,
	projectMemberQuery,
	updateIssueById,
} from "~/modules/queries.server";
import {
	ISSUE_PRIORITY_CONFIG,
	ISSUE_STATUS_CONFIG,
	type IssuePriority,
	type IssueStatus,
	cx,
	title,
	useDebouncedCallback,
	useRequestInfo,
	useUser,
} from "~/modules/shared/utils";
import {
	badRequest,
	requireAuth,
	safeQuery,
	unauthorized,
} from "~/modules/shared/utils.server";
import type { Loader as FilterProjectsLoader } from "~/routes/resources+/filter-projects";
import { NewIssueDialog } from "./new-issue-dialog";
import { FormSchema, Intent } from "./shared";

const SORT_BY_OPTIONS = ["priority", "status", "created", "updated"] as const;
const DEFAULT_SORT_BY: (typeof SORT_BY_OPTIONS)[number] = "created";

const ORDER_OPTIONS = ["asc", "desc"] as const;
const DEFAULT_ORDER: (typeof ORDER_OPTIONS)[number] = "desc";

enum SearchKeys {
	Exclusive = "exclusive",
	Status = "status",
	Priority = "priority",
	Project = "project",
	SortBy = "sortBy",
	Order = "order",
}
type SearchParamsSchema = z.infer<typeof SearchParamsSchema>;
const SearchParamsSchema = z.object({
	[SearchKeys.Exclusive]: z
		.enum([SearchKeys.Status, SearchKeys.Priority])
		.array()
		.optional(),
	[SearchKeys.Status]: z.number().array().default([]),
	[SearchKeys.Priority]: z.number().array().default([]),
	[SearchKeys.Project]: z.string().array().default([]),
	[SearchKeys.SortBy]: z.enum(SORT_BY_OPTIONS).default(DEFAULT_SORT_BY),
	[SearchKeys.Order]: z.enum(ORDER_OPTIONS).default(DEFAULT_ORDER),
} satisfies Record<SearchKeys, unknown>);

export const meta: MetaFunction = () => {
	return [{ title: title("Issues") }];
};

export type Loader = typeof loader;
export async function loader({ request, context }: LoaderFunctionArgs) {
	requireAuth(context);

	const url = new URL(request.url);
	const parse = parseWithZod(url.searchParams, { schema: SearchParamsSchema });

	if (parse.status !== "success") {
		throw new Response(null, {
			status: 400,
			statusText: "Bad Request",
		});
	}

	const searchParams = parse.value;

	const projectsPromise =
		searchParams[SearchKeys.Project].length > 0
			? db
					.select({ id: Project.id, name: Project.name })
					.from(Project)
					.innerJoin(ProjectMember, eq(Project.id, ProjectMember.projectId))
					.where(() => {
						const isMember = eq(ProjectMember.userId, context.user.id);

						return or(
							isMember,
							and(
								isMember,
								inArray(Project.id, searchParams[SearchKeys.Project]),
							),
						);
					})
					.orderBy(
						desc(inArray(Project.id, searchParams[SearchKeys.Project])),
						desc(Project.createdAt),
					)
					.limit(Math.max(searchParams[SearchKeys.Project].length, 2))
					.all()
			: Promise.resolve([]);

	const [issues, error] = await safeQuery(
		db
			.select({
				id: Issue.id,
				createdAt: Issue.createdAt,
				projectId: Issue.projectId,
				priority: Issue.priority,
				status: Issue.status,
				title: Issue.title,
				creator: User.fullName,
			})
			.from(Issue)
			.innerJoin(User, eq(Issue.createdBy, User.id))
			.innerJoin(ProjectMember, eq(Issue.projectId, ProjectMember.projectId))
			.where(() => {
				const extraFilters: Array<SQL> = [];
				if (
					searchParams[SearchKeys.Status] &&
					searchParams[SearchKeys.Status].length > 0
				) {
					const method = searchParams[SearchKeys.Exclusive]?.includes(
						SearchKeys.Status,
					)
						? notInArray
						: inArray;
					extraFilters.push(
						method(Issue.status, searchParams[SearchKeys.Status]),
					);
				}
				if (
					searchParams[SearchKeys.Priority] &&
					searchParams[SearchKeys.Priority].length > 0
				) {
					const method = searchParams[SearchKeys.Exclusive]?.includes(
						SearchKeys.Priority,
					)
						? notInArray
						: inArray;
					extraFilters.push(
						method(Issue.priority, searchParams[SearchKeys.Priority]),
					);
				}
				if (
					searchParams?.project &&
					searchParams[SearchKeys.Project].length > 0
				) {
					extraFilters.push(
						inArray(Issue.projectId, searchParams[SearchKeys.Project]),
					);
				}

				return and(eq(ProjectMember.userId, context.user.id), ...extraFilters);
			})
			.orderBy(() => {
				const direction = searchParams[SearchKeys.Order] === "asc" ? asc : desc;
				const columns = {
					created: Issue.createdAt,
					priority: Issue.priority,
					status: Issue.status,
					updated: Issue.updatedAt,
				} satisfies Record<SearchParamsSchema["sortBy"], unknown>;
				const column = columns[searchParams.sortBy];

				return direction(column);
			}),
	);

	if (error) {
		throw error;
	}

	return defer({
		projectsPromise,
		issues,
	});
}

export type Action = typeof action;
export async function action({ request, context }: ActionFunctionArgs) {
	requireAuth(context);

	const formData = await request.formData();

	const sub = parseWithZod(formData, { schema: FormSchema });

	if (sub.status !== "success") {
		return json(sub.reply());
	}

	const payload = sub.value;
	let error: Error | null = null;

	const projectMember = await projectMemberQuery.get({
		projectId: payload.projectId,
		userId: context.user.id,
	});

	if (!projectMember) {
		throw unauthorized();
	}

	switch (payload.intent) {
		case Intent.CreateIssue: {
			const [, resError] = await createIssue(context, payload);
			error = resError;

			break;
		}
		case Intent.DeleteIssue: {
			const [, resError] = await deleteIssueById(context, payload);
			error = resError;

			break;
		}
		case Intent.UpdateIssue: {
			const [, resError] = await updateIssueById(context, payload);
			error = resError;

			break;
		}
		default:
			throw badRequest("Invalid intent");
	}

	return error
		? jsonWithError(null, {
				message: error.message,
			})
		: null;
}

function useIssues() {
	const { issues } = useLoaderData<Loader>();
	const fetchers = useFetchers();

	const user = useUser();

	return fetchers.reduce(
		(acc, fetcher) => {
			if (fetcher.formData) {
				const sub = parseWithZod(fetcher.formData, { schema: FormSchema });

				if (sub.status === "success") {
					const payload = sub.value;
					const now = new Date().toUTCString();

					switch (payload.intent) {
						case Intent.CreateIssue: {
							payload.id &&
								acc.set(payload.id, {
									id: payload.id,
									createdAt: now,
									creator: `${user.firstName} ${user.lastName}`,
									projectId: payload.projectId,
									status: payload.status,
									priority: payload.priority,
									title: payload.title,
								});
							break;
						}
						case Intent.DeleteIssue: {
							acc.delete(payload.id);
							break;
						}
						case Intent.UpdateIssue: {
							const project = acc.get(payload.id);
							if (project) {
								acc.set(project.id, { ...project, ...payload });
							}

							break;
						}
						default:
							break;
					}
				}
			}

			return acc;
		},
		new Map(issues.map((issue) => [issue.id, issue])),
	);
}

export default function Route() {
	return (
		<div className="flex flex-col gap-4 container py-4">
			<div className="flex items-start sm:items-center justify-between">
				<div className="flex flex-wrap items-center gap-2">
					<IssuesFilter />
					<IssuesSort />
					<ProjectsSelect />
				</div>

				<NewIssueDialog>
					<Button size="sm">Create issue</Button>
				</NewIssueDialog>
			</div>

			<div className="flex items-center gap-4">
				<IssuesFiltersList param={SearchKeys.Status} />
				<IssuesFiltersList param={SearchKeys.Priority} />
			</div>

			<IssuesList />
		</div>
	);
}

function IssuesFilter() {
	const [searchParams, setSearchParams] = useSearchParams();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="sm" variant="secondary">
					<Icon name="list-filter" className="mr-2" />
					Filters
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent className="w-56">
				<DropdownMenuLabel>Status</DropdownMenuLabel>
				{Object.entries(ISSUE_STATUS_CONFIG).map(([value, config]) => (
					<DropdownMenuCheckboxItem
						key={value}
						indicatorPosition="right"
						checked={searchParams.has(SearchKeys.Status, value)}
						onCheckedChange={(isChecked) => {
							setSearchParams(
								(prev) => {
									isChecked
										? prev.append(SearchKeys.Status, value)
										: prev.delete(SearchKeys.Status, value);
									return prev;
								},
								{ replace: true },
							);
						}}
						onSelect={(e) => e.preventDefault()}
					>
						<Icon name={config.icon} className="mr-2" />
						{config.label}
					</DropdownMenuCheckboxItem>
				))}

				<DropdownMenuSeparator />

				<DropdownMenuLabel>Priority</DropdownMenuLabel>
				{Object.entries(ISSUE_PRIORITY_CONFIG).map(([value, config]) => (
					<DropdownMenuCheckboxItem
						key={value}
						indicatorPosition="right"
						checked={searchParams.has(SearchKeys.Priority, value)}
						onCheckedChange={(isChecked) => {
							setSearchParams(
								(prev) => {
									isChecked
										? prev.append(SearchKeys.Priority, value)
										: prev.delete(SearchKeys.Priority, value);
									return prev;
								},
								{ replace: true },
							);
						}}
						onSelect={(e) => e.preventDefault()}
					>
						<Icon name={config.icon} className="mr-2" />
						{config.label}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
function IssuesSort() {
	const [searchParams, setSearchParams] = useSearchParams();

	const sortBy = searchParams.get(SearchKeys.SortBy) || DEFAULT_SORT_BY;
	const order = searchParams.get(SearchKeys.Order) || DEFAULT_ORDER;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="secondary" size="icon" className="size-8">
					<Icon name="arrow-down-wide-narrow">
						<span className="sr-only">Filter issues</span>
					</Icon>
				</Button>
			</PopoverTrigger>

			<PopoverContent className="p-0">
				<div className="p-3 border-b">
					<p className="text-xs font-semibold">View options</p>
				</div>

				<div className="flex p-2 items-center">
					<span className="flex-1 text-sm font-medium">Ordering</span>

					<div className="flex gap-2">
						<Select
							value={sortBy}
							onValueChange={(value) => {
								setSearchParams((prev) => {
									prev.set(SearchKeys.SortBy, value);
									return prev;
								});
							}}
						>
							<SelectTrigger className="w-24 capitalize">
								<SelectValue />
							</SelectTrigger>

							<SelectContent>
								{SORT_BY_OPTIONS.map((s) => (
									<SelectItem key={s} value={s} className="capitalize">
										{s}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select
							value={order}
							onValueChange={(value) => {
								setSearchParams((prev) => {
									prev.set(SearchKeys.Order, value);
									return prev;
								});
							}}
						>
							<SelectTrigger className="w-20 capitalize">
								<SelectValue />
							</SelectTrigger>

							<SelectContent>
								{ORDER_OPTIONS.map((o) => (
									<SelectItem key={o} value={o} className="capitalize">
										{o}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
function ProjectsSelect() {
	const { projectsPromise } = useLoaderData<Loader>();
	const fetcher = useFetcher<FilterProjectsLoader>();
	const [searchParams, setSearchParams] = useSearchParams();

	const formRef = useRef<HTMLFormElement>(null);

	const handleSearch = useDebouncedCallback((q: string) => {
		if (q) fetcher.submit(formRef.current);
	}, 400);

	const selectedProjects = searchParams.getAll(SearchKeys.Project);

	return (
		<Suspense>
			<Await resolve={projectsPromise}>
				{(projects) => {
					const maxCount = 1;
					const optionsMap = new Map(projects.map((p) => [p.id, p]));

					if (fetcher.data) {
						for (const data of fetcher.data) {
							optionsMap.set(data.id, data);
						}
					}

					const options = [...optionsMap.values()];

					return (
						<Popover
							onOpenChange={() => {
								formRef.current?.reset();
							}}
						>
							<PopoverTrigger asChild>
								<Button className="flex w-48 sm:w-60 py-0.5 px-1 sm:px-2 rounded-md border min-h-8 h-auto items-center justify-between bg-inherit hover:bg-inherit">
									{selectedProjects.length > 0 ? (
										<div className="flex justify-between items-center w-full">
											<div className="flex flex-wrap gap-1 items-center">
												{options.map((project) => {
													if (!searchParams.has(SearchKeys.Project, project.id))
														return null;
													if (selectedProjects.indexOf(project.id) >= maxCount)
														return null;

													return (
														<Badge key={project.id} size="sm">
															{project.name}
															<Icon
																name="x"
																className="ml-2 h-4 w-4 cursor-pointer"
																onClick={(event) => {
																	event.stopPropagation();
																	setSearchParams(
																		(prev) => {
																			prev.delete(
																				SearchKeys.Project,
																				project.id,
																			);
																			return prev;
																		},
																		{ replace: true },
																	);
																}}
															/>
														</Badge>
													);
												})}
												{selectedProjects.length > maxCount && (
													<Badge size="sm">
														{`+ ${selectedProjects.length - maxCount} more`}
														<Icon
															name="x"
															className="ml-2 h-4 w-4 cursor-pointer"
															onClick={(event) => {
																event.stopPropagation();
																setSearchParams(
																	(prev) => {
																		for (const [
																			index,
																			id,
																		] of selectedProjects.entries()) {
																			if (index >= maxCount) {
																				prev.delete(SearchKeys.Project, id);
																			}
																		}

																		return prev;
																	},
																	{ replace: true },
																);
															}}
														/>
													</Badge>
												)}
											</div>
											<div className="flex items-center justify-end gap-2">
												<Icon
													name="x"
													className="cursor-pointer text-muted-foreground"
													onClick={(event) => {
														event.stopPropagation();
														setSearchParams(
															(prev) => {
																prev.delete(SearchKeys.Project);
																return prev;
															},
															{ replace: true },
														);
													}}
												/>
												<Separator
													orientation="vertical"
													className="flex min-h-6 h-full"
												/>
												<Icon
													name="chevron-down"
													className="cursor-pointer text-muted-foreground"
												/>
											</div>
										</div>
									) : (
										<div className="flex items-center justify-between w-full mx-auto">
											<span className="text-sm text-muted-foreground mx-3">
												Select projects
											</span>
											<Icon
												name="chevron-down"
												className="cursor-pointer text-muted-foreground"
											/>
										</div>
									)}
								</Button>
							</PopoverTrigger>

							<PopoverContent
								className="w-popover p-0 overflow-hidden"
								align="start"
							>
								<LoaderBar
									className={fetcher.state === "idle" ? "hidden" : undefined}
								/>

								<Command>
									<div className="relative">
										<fetcher.Form
											ref={formRef}
											method="GET"
											action="/resources/filter-projects"
										>
											<CommandInput
												name="q"
												placeholder="Search..."
												onValueChange={handleSearch}
											/>
										</fetcher.Form>
									</div>
									<CommandList>
										<CommandEmpty>No projects found.</CommandEmpty>

										<CommandGroup>
											{options.map((option) => {
												const isSelected = searchParams.has(
													SearchKeys.Project,
													option.id,
												);

												return (
													<CommandItem
														key={option.id}
														value={option.id}
														keywords={[option.name]}
														className="cursor-pointer"
														onSelect={(projectId) => {
															setSearchParams(
																(prev) => {
																	prev.has(SearchKeys.Project, projectId)
																		? prev.delete(SearchKeys.Project, projectId)
																		: prev.append(
																				SearchKeys.Project,
																				projectId,
																			);
																	return prev;
																},
																{ replace: true },
															);
														}}
													>
														<div
															className={cx(
																"mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
																isSelected
																	? "bg-primary text-primary-foreground"
																	: "opacity-50 [&_svg]:invisible",
															)}
														>
															<Icon name="check" />
														</div>

														<span>{option.name}</span>
													</CommandItem>
												);
											})}
										</CommandGroup>
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					);
				}}
			</Await>
		</Suspense>
	);
}

const FILTERS_CONFIG = {
	[SearchKeys.Priority]: ISSUE_PRIORITY_CONFIG,
	[SearchKeys.Status]: ISSUE_STATUS_CONFIG,
} as const satisfies Partial<Record<SearchKeys, unknown>>;

function IssuesFiltersList(props: { param: keyof typeof FILTERS_CONFIG }) {
	const [searchParams, setSearchParams] = useSearchParams();

	const isExclusive = searchParams.has(SearchKeys.Exclusive, props.param);
	const values = searchParams.getAll(props.param);
	const configList = FILTERS_CONFIG[props.param] as Record<
		number,
		{ label: string; icon: string }
	>;

	return values.length === 0 ? null : (
		<div className="bg-primary text-primary-foreground inline-flex items-stretch rounded-md divide-x divide-background/40 text-xs font-medium">
			<button
				type="button"
				className="capitalize px-2 py-0.5"
				onClick={() => {
					setSearchParams(
						(prev) => {
							prev.has(SearchKeys.Exclusive, props.param)
								? prev.delete(SearchKeys.Exclusive, props.param)
								: prev.append(SearchKeys.Exclusive, props.param);

							return prev;
						},
						{ replace: true },
					);
				}}
			>
				{props.param} {isExclusive ? "is not" : "is"}:
			</button>
			<span className="px-2 py-0.5">
				{values.reduce((acc, v) => {
					const weight = Number.parseInt(v, 10);
					const config = configList[weight];

					if (config) {
						return acc ? `${acc}, ${config.label}` : config.label;
					}

					return acc;
				}, "")}
			</span>

			<button
				type="button"
				className="flex items-center justify-center px-1"
				onClick={() =>
					setSearchParams(
						(prev) => {
							prev.delete(props.param);
							prev.delete(SearchKeys.Exclusive);
							return prev;
						},
						{ replace: true },
					)
				}
			>
				<Icon name="x" size="sm">
					<span className="sr-only">Clear {props.param} filters</span>
				</Icon>
			</button>
		</div>
	);
}

function IssuesList() {
	const issues = useIssues();
	const [searchParams] = useSearchParams();

	const checkForSearchParams = (payload: {
		projectId: string;
		status: IssueStatus;
		priority: IssuePriority;
	}) => {
		const exclusive = searchParams.getAll(SearchKeys.Exclusive);
		const hasOneStatus = searchParams.has(SearchKeys.Status);
		const hasThisStatus = searchParams.has(
			SearchKeys.Status,
			`${payload.status}`,
		);
		const hasOnePrio = searchParams.has(SearchKeys.Priority);
		const hasThisPrio = searchParams.has(
			SearchKeys.Priority,
			`${payload.priority}`,
		);

		const statusCheck = exclusive.includes(SearchKeys.Status)
			? !hasThisStatus
			: !hasOneStatus || hasThisStatus;

		const priorityCheck = exclusive.includes(SearchKeys.Priority)
			? !hasThisPrio
			: !hasOnePrio || hasThisPrio;

		const projectCheck =
			!searchParams.has(SearchKeys.Project) ||
			searchParams.has(SearchKeys.Project, payload.projectId);

		return statusCheck && priorityCheck && projectCheck;
	};
	const hasFilters =
		searchParams.has(SearchKeys.Exclusive) ||
		searchParams.has(SearchKeys.Priority) ||
		searchParams.has(SearchKeys.Project) ||
		searchParams.has(SearchKeys.Status);

	return (
		<Card>
			<ul className="divide-y">
				{[...issues.values()].map((issue) =>
					checkForSearchParams(issue) ? (
						<IssueItem key={issue.id} issue={issue} />
					) : null,
				)}

				<li className="hidden first:list-item">
					<p className="text-muted-foreground text-center italic py-4">
						{hasFilters ? "No issues found" : "Create a new issue"}
					</p>
				</li>
			</ul>
		</Card>
	);
}

function IssueItem(props: {
	issue: SerializeFrom<Loader>["issues"][number];
}) {
	const [firstName, secondName] = props.issue.creator.split(" ");

	return (
		<li>
			<div className="flex items-stretch gap-2 sm:gap-4 py-2 px-2 sm:px-4">
				<PriorityPicker
					id={props.issue.id}
					priority={props.issue.priority}
					projectId={props.issue.projectId}
				/>

				<StatusPicker
					id={props.issue.id}
					status={props.issue.status}
					projectId={props.issue.projectId}
				/>

				<Link to={props.issue.id} className="flex-1 flex items-center">
					{props.issue.title}
				</Link>

				<IssueDate createdAt={props.issue.createdAt} />

				<Avatar className="size-8">
					<AvatarFallback>
						{firstName.charAt(0)}
						{secondName.charAt(0)}
					</AvatarFallback>
				</Avatar>

				<DeleteIssueButton
					id={props.issue.id}
					projectId={props.issue.projectId}
				/>
			</div>
		</li>
	);
}

function PriorityPicker(props: {
	id: string;
	projectId: string;
	priority: IssuePriority;
}) {
	const fetcher = useFetcher();

	const priority = ISSUE_PRIORITY_CONFIG[props.priority];

	return (
		<fetcher.Form method="POST">
			<Tooltip>
				<PriorityDropdown
					value={props.priority.toString()}
					onValueChange={(priority) => {
						const formData = new FormData();
						formData.append("intent", Intent.UpdateIssue);
						formData.append("id", props.id);
						formData.append("priority", priority);
						formData.append("projectId", props.projectId);

						fetcher.submit(formData, { method: "POST" });
					}}
				>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon">
							<Icon name={priority.icon}>
								<span className="sr-only">{priority.label}</span>
							</Icon>
						</Button>
					</TooltipTrigger>
				</PriorityDropdown>

				<TooltipContent>{priority.label}</TooltipContent>
			</Tooltip>
		</fetcher.Form>
	);
}

function StatusPicker(props: {
	id: string;
	projectId: string;
	status: IssueStatus;
}) {
	const fetcher = useFetcher();

	const status = ISSUE_STATUS_CONFIG[props.status];

	return (
		<fetcher.Form method="POST">
			<Tooltip>
				<StatusDropdown
					value={props.status.toString()}
					onValueChange={(status) => {
						const formData = new FormData();
						formData.append("intent", Intent.UpdateIssue);
						formData.append("id", props.id);
						formData.append("status", status);
						formData.append("projectId", props.projectId);

						fetcher.submit(formData, { method: "POST" });
					}}
				>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon">
							<Icon
								name={status.icon}
								className={"color" in status ? status.color : undefined}
							>
								<span className="sr-only">{status.label}</span>
							</Icon>
						</Button>
					</TooltipTrigger>
				</StatusDropdown>

				<TooltipContent>{status.label}</TooltipContent>
			</Tooltip>
		</fetcher.Form>
	);
}

function IssueDate(props: { createdAt: string }) {
	const reqInfo = useRequestInfo();

	const timeZone = reqInfo.hints.timeZone;
	const date = new Date(props.createdAt);

	return (
		<span
			className="text-sm text-muted-foreground hidden sm:flex sm:items-center"
			title={date.toLocaleString("en-US", { timeZone })}
		>
			{new Intl.DateTimeFormat("en-US", {
				day: "2-digit",
				month: "short",
				timeZone,
			}).format(date)}
		</span>
	);
}

function DeleteIssueButton(props: { id: string; projectId: string }) {
	const fetcher = useFetcher();

	return (
		<fetcher.Form method="POST">
			<input type="hidden" name="id" value={props.id} />
			<input type="hidden" name="projectId" value={props.projectId} />

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="submit"
						variant="outline"
						size="icon"
						name="intent"
						value={Intent.DeleteIssue}
					>
						<Icon name="trash">
							<span className="sr-only">Delete issue</span>
						</Icon>
					</Button>
				</TooltipTrigger>

				<TooltipContent>Delete issue</TooltipContent>
			</Tooltip>
		</fetcher.Form>
	);
}
