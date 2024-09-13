import { getFormProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { createId } from "@paralleldrive/cuid2";
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node";
import {
	Form,
	Link,
	useActionData,
	useFetcher,
	useFetchers,
	useLoaderData,
} from "@remix-run/react";
import { eq, ne, sql } from "drizzle-orm";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { jsonWithError } from "remix-toast";
import { z } from "zod";
import { Icon } from "~/components/icons/icons";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { ConformInput } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { db } from "~/modules/db.server/client";
import { Issue, Project, ProjectMember } from "~/modules/db.server/schema";
import {
	createProject,
	deleteProjectById,
	updateProject,
} from "~/modules/queries.server";
import { IssueStatus, title, useZodForm } from "~/modules/shared/utils";
import { requireAuth, safeQuery } from "~/modules/shared/utils.server";
import { useUser } from "~/modules/user";

enum Intent {
	Create_Project = "create_project",
	Delete_Project = "delete_project",
	Update_Project = "update_project",
}
const FormSchema = z.discriminatedUnion("intent", [
	z.object({
		intent: z.literal(Intent.Create_Project),
		id: z.string().optional(),
		name: z.string().min(1),
	}),
	z.object({
		intent: z.literal(Intent.Delete_Project),
		id: z.string(),
	}),
	z.object({
		intent: z.literal(Intent.Update_Project),
		id: z.string(),
		name: z.string().optional(),
	}),
]);
const projectsQuery = db
	.select({
		id: Project.id,
		createdBy: Project.createdBy,
		name: Project.name,
		description: Project.description,
		role: ProjectMember.role,
		totalIssuesCount: sql<number>`count(case when ${ne(Issue.status, IssueStatus.Canceled)} then 1 end)`,
		doneIssuesCount: sql<number>`count(case when ${eq(Issue.status, IssueStatus.Done)} then 1 end)`,
	})
	.from(Project)
	.innerJoin(ProjectMember, eq(Project.id, ProjectMember.projectId))
	.leftJoin(Issue, eq(Project.id, Issue.projectId))
	.where(eq(ProjectMember.userId, sql.placeholder("userId")))
	.groupBy(Project.id)
	.orderBy(Project.createdAt)
	.prepare();

export const meta: MetaFunction = () => {
	return [{ title: title("Projects") }];
};

export type Loader = typeof loader;
export async function loader({ context }: LoaderFunctionArgs) {
	requireAuth(context);

	const [projects, error] = await safeQuery(
		projectsQuery.all({ userId: context.user.id }),
	);

	if (error) {
		throw error;
	}

	return json({ projects });
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

	switch (payload.intent) {
		case Intent.Create_Project: {
			const [, resError] = await createProject(context, payload);
			error = resError;

			break;
		}
		case Intent.Delete_Project: {
			const [, resError] = await deleteProjectById(context, payload.id);
			error = resError;

			break;
		}
		case Intent.Update_Project: {
			const [, resError] = await updateProject(context, payload);
			error = resError;

			break;
		}
		default:
			return jsonWithError(null, { message: "Invalid intent" });
	}

	return error
		? jsonWithError(null, {
				message: error.message,
			})
		: null;
}

export function useProjects() {
	const fetchers = useFetchers();
	const data = useLoaderData<Loader>();

	const user = useUser();

	return [
		...fetchers
			.reduce(
				(acc, fetcher) => {
					if (fetcher.formData) {
						const sub = parseWithZod(fetcher.formData, { schema: FormSchema });

						if (sub.status === "success") {
							const payload = sub.value;

							switch (payload.intent) {
								case Intent.Create_Project: {
									payload.id &&
										acc.set(payload.id, {
											id: payload.id,
											createdBy: user.id,
											name: payload.name,
											description: "",
											role: "ADMIN",
											doneIssuesCount: 0,
											totalIssuesCount: 0,
										});
									break;
								}
								case Intent.Delete_Project: {
									acc.delete(payload.id);
									break;
								}
								case Intent.Update_Project: {
									const project = acc.get(payload.id);
									project &&
										acc.set(payload.id, {
											...project,
											name: payload.name || project.name,
										});
									break;
								}
								default:
									break;
							}
						}
					}

					return acc;
				},
				new Map(data.projects.map((p) => [p.id, p] as const)),
			)
			.values(),
	];
}

export default function Route() {
	return (
		<div className="flex flex-col gap-4 container py-4">
			<div className="flex items-center justify-between">
				<h1 className="text-sm font-medium text-muted-foreground">Projects</h1>
				<NewProjectModal />
			</div>

			<ProjectsList />
		</div>
	);
}

function NewProjectModal() {
	const data = useActionData<Action>();

	const [isOpen, setIsOpen] = useState(false);
	const [form, fields] = useZodForm({
		lastResult: data,
		schema: FormSchema,
		onSubmit: () => {
			setIsOpen(false);
		},
	});

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button size="sm">Create project</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Create project</DialogTitle>
					<DialogDescription>
						Create a new Project to group all your issues.
					</DialogDescription>
				</DialogHeader>
				<Form navigate={false} method="POST" {...getFormProps(form)}>
					<input type="hidden" name="intent" value={Intent.Create_Project} />
					<input type="hidden" name="id" value={createId()} />
					<ConformInput meta={fields.name} label="Name" />
				</Form>
				<DialogFooter>
					<Button type="submit" id={form.id}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ProjectsList() {
	const projects = useProjects();
	const user = useUser();

	return (
		<ul
			className="grid gap-4"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}
		>
			{projects.map((project) => {
				const isOwner = project.createdBy === user.id;
				const progress = project.totalIssuesCount
					? (project.doneIssuesCount / project.totalIssuesCount) * 100
					: 0;

				return (
					<li key={project.id}>
						<Card>
							<CardHeader className="flex flex-row items-center gap-3">
								<div className="flex-1">
									<EditableProjectName
										id={project.id}
										name={project.name}
										createdBy={project.createdBy}
									/>

									{project.description ? (
										<CardDescription className="line-clamp-2">
											{project.description}
										</CardDescription>
									) : null}
								</div>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											asChild
											variant="outline"
											size="icon"
											className="size-8"
										>
											<Link
												to={{
													pathname: "/app/issues",
													search: `?project=${project.id}`,
												}}
											>
												<Icon name="pin">
													<span className="sr-only">View issues</span>
												</Icon>
											</Link>
										</Button>
									</TooltipTrigger>

									<TooltipContent>View issues</TooltipContent>
								</Tooltip>

								{isOwner ? (
									<DeleteProjectButton
										id={project.id}
										createdBy={project.createdBy}
									/>
								) : null}
							</CardHeader>
							<CardContent>
								<div className="flex flex-col gap-1">
									<p className="text-xs text-right text-muted-foreground">
										{project.totalIssuesCount
											? `${project.doneIssuesCount}/${project.totalIssuesCount} issues completed`
											: "No issues in this project"}
									</p>
									<Progress value={progress} />
								</div>
							</CardContent>

							{project.role === "ADMIN" ? (
								<CardFooter>
									<Button asChild className="w-full">
										<Link prefetch="intent" to={`/app/projects/${project.id}`}>
											Manage
										</Link>
									</Button>
								</CardFooter>
							) : null}
						</Card>
					</li>
				);
			})}

			<li className="hidden first:list-item col-span-full text-muted-foreground italic text-center">
				Create a new project.
			</li>
		</ul>
	);
}

function DeleteProjectButton(props: { id: string; createdBy: string }) {
	const fetcher = useFetcher();

	const user = useUser();

	return (
		<fetcher.Form method="POST">
			<input type="hidden" name="intent" value={Intent.Delete_Project} />

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="submit"
						variant="outline"
						size="icon"
						className="size-8"
						name="id"
						value={props.id}
						disabled={user.id !== props.createdBy}
					>
						<Icon name="trash-2">
							<span className="sr-only">Delete project</span>
						</Icon>
					</Button>
				</TooltipTrigger>

				<TooltipContent>Delete project</TooltipContent>
			</Tooltip>
		</fetcher.Form>
	);
}

function EditableProjectName(props: {
	id: string;
	name: string;
	createdBy: string;
}) {
	const fetcher = useFetcher<Action>();

	const [isEditing, setIsEditing] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const user = useUser();

	const handleDoneEditing = () => {
		flushSync(() => {
			setIsEditing(false);
		});
		buttonRef.current?.focus();
	};

	const optmisticName = fetcher.formData
		? String(fetcher.formData.get("name"))
		: props.name;

	return isEditing ? (
		<fetcher.Form
			method="POST"
			className="flex-1"
			onSubmit={() => handleDoneEditing()}
		>
			<input type="hidden" name="intent" value={Intent.Update_Project} />
			<input type="hidden" name="id" value={props.id} />
			<input
				required
				ref={(node) => node?.select()}
				name="name"
				className="bg-transparent py-1 font-semibold w-full"
				defaultValue={optmisticName}
				onBlur={() => handleDoneEditing()}
				onKeyUp={(e) => {
					if (e.key === "Escape") handleDoneEditing();
				}}
			/>
		</fetcher.Form>
	) : (
		<button
			ref={buttonRef}
			type="button"
			className="flex-1 py-2"
			disabled={user.id !== props.createdBy}
			onClick={() => setIsEditing(true)}
		>
			<CardTitle className="text-left">{optmisticName}</CardTitle>
		</button>
	);
}
