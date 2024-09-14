import {
	getFormProps,
	getInputProps,
	useInputControl,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { invariantResponse } from "@epic-web/invariant";
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
	redirect,
	useFetcher,
	useFetchers,
	useLoaderData,
	useNavigation,
} from "@remix-run/react";
import { and, desc, eq, sql } from "drizzle-orm";
import { useRef } from "react";
import { jsonWithError } from "remix-toast";
import { z } from "zod";
import { Icon } from "~/components/icons/icons";
import { PriorityDropdown } from "~/components/priority-dropdown";
import { RichTextEditor } from "~/components/rich-text-editor";
import { StatusDropdown } from "~/components/status-dropdown";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { ConformTextarea } from "~/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { db } from "~/modules/db.server/client";
import {
	Comment,
	Issue,
	Project,
	ProjectMember,
	User,
} from "~/modules/db.server/schema";
import {
	createComment,
	deleteCommentById,
	deleteIssueById,
	updateIssueById,
} from "~/modules/queries.server";
import {
	ISSUE_PRIORITY_CONFIG,
	ISSUE_STATUS_CONFIG,
	IssuePriority,
	IssueStatus,
	cx,
	title,
	useDebouncedCallback,
	useZodForm,
} from "~/modules/shared/utils";
import {
	badRequest,
	requireAuth,
	safeQuery,
} from "~/modules/shared/utils.server";
import { useUser } from "~/modules/user";
import { ProjectCombobox } from "~/routes/resources+/filter-projects";

enum Intent {
	DeleteIssue = "delete_issue",
	UpdateTitle = "update_title",
	UpdateIssue = "update_issue",
	UpdateDescription = "update_description",
	CreateComment = "create_comment",
	DeleteComment = "delete_comment",
}
const FormSchema = z.discriminatedUnion("intent", [
	z.object({
		intent: z.literal(Intent.DeleteIssue),
	}),
	z.object({
		intent: z.literal(Intent.UpdateTitle),
		title: z.string().min(1),
	}),
	z.object({
		intent: z.literal(Intent.UpdateDescription),
		description: z.string().optional(),
	}),
	z.object({
		intent: z.literal(Intent.CreateComment),
		id: z.string().optional(),
		content: z.string().min(1),
	}),
	z.object({
		intent: z.literal(Intent.DeleteComment),
		id: z.string(),
	}),
	z.object({
		intent: z.literal(Intent.UpdateIssue),
		status: z
			.number()
			.refine((s) => IssueStatus[s], "Invalid Status")
			.optional(),
		priority: z
			.number()
			.refine((p) => IssuePriority[p], "Invalid Priority")
			.optional(),
		projectId: z.string().optional(),
	}),
]);
const issueQuery = db
	.select({
		title: Issue.title,
		description: Issue.description,
		status: Issue.status,
		priority: Issue.priority,
		project: {
			id: Project.id,
			name: Project.name,
			role: ProjectMember.role,
		},
		creator: User.fullName,
	})
	.from(Issue)
	.innerJoin(ProjectMember, eq(Issue.projectId, ProjectMember.projectId))
	.innerJoin(Project, eq(Issue.projectId, Project.id))
	.innerJoin(User, eq(Issue.createdBy, User.id))
	.where(
		and(
			eq(Issue.id, sql.placeholder("issueId")),
			eq(ProjectMember.userId, sql.placeholder("userId")),
		),
	)
	.prepare();
const commentsQuery = db
	.select({
		id: Comment.id,
		content: Comment.content,
		createBy: Comment.createdBy,
		creator: User.fullName,
	})
	.from(Comment)
	.innerJoin(User, eq(Comment.createdBy, User.id))
	.innerJoin(Issue, eq(Comment.issueId, Issue.id))
	.innerJoin(ProjectMember, eq(Issue.projectId, ProjectMember.projectId))
	.where(
		and(
			eq(Comment.issueId, sql.placeholder("issueId")),
			eq(ProjectMember.userId, sql.placeholder("userId")),
		),
	)
	.orderBy(desc(Comment.createdAt))
	.prepare();

export const meta: MetaFunction<Loader> = ({ data }) => [
	{ title: title(data?.issue.title ?? "") },
];

export type Loader = typeof loader;
export async function loader({ context, params }: LoaderFunctionArgs) {
	requireAuth(context);

	const { issueId } = params;
	invariantResponse(issueId, "Missing Issue ID");

	const [[issue], [comments]] = await Promise.all([
		safeQuery(issueQuery.get({ issueId, userId: context.user.id })),
		safeQuery(commentsQuery.all({ issueId, userId: context.user.id })),
	]);

	invariantResponse(issue, "Not found", { status: 404 });

	return json({ issue, comments: comments ?? [] });
}

export type Action = typeof action;
export async function action({ context, params, request }: ActionFunctionArgs) {
	const { issueId } = params;
	invariantResponse(issueId, "Missing Issue ID");

	requireAuth(context);

	const formData = await request.formData();
	const sub = parseWithZod(formData, { schema: FormSchema });

	if (sub.status !== "success") {
		return json(sub.reply());
	}

	const payload = sub.value;
	let error: Error | null = null;

	switch (payload.intent) {
		case Intent.DeleteIssue: {
			const [, resError] = await deleteIssueById(context, { id: issueId });
			error = resError;

			throw redirect("/app/issues");
		}
		case Intent.UpdateTitle: {
			const [, resError] = await updateIssueById(context, {
				id: issueId,
				title: payload.title,
			});
			error = resError;

			break;
		}
		case Intent.UpdateDescription: {
			const [, resError] = await updateIssueById(context, {
				id: issueId,
				description: payload.description ?? "",
			});
			error = resError;

			break;
		}
		case Intent.CreateComment: {
			const [, resError] = await createComment({
				...payload,
				createdBy: context.user.id,
				issueId,
			});
			error = resError;

			break;
		}
		case Intent.DeleteComment: {
			const [, resError] = await deleteCommentById({ id: payload.id });
			error = resError;

			break;
		}
		case Intent.UpdateIssue: {
			const [, resError] = await updateIssueById(context, {
				id: issueId,
				status: payload.status,
				priority: payload.priority,
				projectId: payload.projectId,
			});
			error = resError;

			break;
		}
		default:
			throw badRequest("Invalid intent");
	}

	sub.reply({ resetForm: true });

	return error
		? jsonWithError(null, {
				message: error.message,
			})
		: json(
				sub.reply({
					resetForm: true,
				}),
			);
}

export function useComments() {
	const { comments } = useLoaderData<Loader>();
	const fetchers = useFetchers();

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
								case Intent.CreateComment: {
									payload.id &&
										acc.set(payload.id, {
											id: payload.id,
											createBy: user.id,
											creator: `${user.firstName} ${user.lastName}`,
											content: payload.content,
										});

									break;
								}
								case Intent.DeleteComment: {
									acc.delete(payload.id);

									break;
								}
								default:
									break;
							}
						}
					}

					return acc;
				},
				new Map(comments.map((c) => [c.id, c])),
			)
			.values(),
	];
}

export default function Route() {
	return (
		<div className="md:h-dvh flex flex-col">
			<div className="flex items-center gap-3 py-2 px-4 border-b">
				<span className="font-semibold mr-auto">Issue</span>

				<DeleteIssueButton />

				<Tooltip>
					<TooltipTrigger asChild>
						<Button asChild variant="outline" size="icon">
							<Link to=".." relative="path">
								<Icon name="x">
									<span className="sr-only">Navigate back</span>
								</Icon>
							</Link>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Go back</TooltipContent>
				</Tooltip>
			</div>

			<div className="flex-1 flex flex-col md:grid grid-cols-3 container overflow-hidden">
				<IssueMeta className="md:hidden py-4 border-b" />

				<div className="col-span-2 flex flex-col gap-4 p-4  overflow-auto">
					<TitleForm />
					<DescriptionForm />
					<Separator />
					<h3>Comments</h3>
					<ScrollArea className="h-96">
						<CommentsList />
					</ScrollArea>
					<CommentsForm />
				</div>

				<div className="p-4 overflow-auto hidden md:block border-l">
					<IssueMeta />
				</div>
			</div>
		</div>
	);
}

function DeleteIssueButton() {
	const navigation = useNavigation();

	const isDeleting =
		navigation.state !== "idle" &&
		navigation.formData?.get("intent") === Intent.DeleteIssue;

	return (
		<Form method="POST">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="submit"
						variant="outline"
						size="icon"
						name="intent"
						value={Intent.DeleteIssue}
						disabled={isDeleting}
					>
						<Icon
							name={isDeleting ? "loader-circle" : "trash"}
							className={isDeleting ? "animate-spin" : undefined}
						>
							<span className="sr-only">Delete issue</span>
						</Icon>
					</Button>
				</TooltipTrigger>
				<TooltipContent>Delete issue</TooltipContent>
			</Tooltip>
		</Form>
	);
}

function TitleForm() {
	const { issue } = useLoaderData<Loader>();
	const fetcher = useFetcher<Action>();

	const formRef = useRef<HTMLFormElement | null>(null);
	const [form, fields] = useZodForm({
		lastResult: fetcher.data,
		schema: FormSchema,
		shouldValidate: "onInput",
		shouldRevalidate: "onInput",
		defaultValue: {
			title: issue.title,
		},
	});

	const handleSubmit = useDebouncedCallback(() => {
		formRef.current?.requestSubmit();
	}, 500);

	return (
		<fetcher.Form ref={formRef} method="POST" {...getFormProps(form)}>
			<input type="hidden" name="intent" value={Intent.UpdateTitle} />
			<Input
				{...getInputProps(fields.title, { type: "text" })}
				className="aria-invalid:border-error"
				onChange={handleSubmit}
			/>
		</fetcher.Form>
	);
}

function DescriptionForm() {
	const { issue } = useLoaderData<Loader>();
	const fetcher = useFetcher<Action>();

	const [form, fields] = useZodForm({
		lastResult: fetcher.data,
		schema: FormSchema,
		shouldRevalidate: "onInput",
		defaultValue: {
			description: issue.description,
		},
	});

	const description = useInputControl(fields.description);

	const handleSubmit = useDebouncedCallback((value: string) => {
		const formData = new FormData();
		formData.set("intent", Intent.UpdateDescription);
		formData.set("description", value);

		fetcher.submit(formData, { method: "POST" });
	}, 500);

	return (
		<fetcher.Form method="POST" {...getFormProps(form)}>
			<RichTextEditor
				className="h-52"
				placeholder="Add description..."
				value={description.value ?? ""}
				onBlur={description.blur}
				onFocus={description.focus}
				onChange={(value) => {
					handleSubmit(value);
					description.change(value);
				}}
			/>
		</fetcher.Form>
	);
}

function CommentsList() {
	const { issue } = useLoaderData<Loader>();

	const comments = useComments();
	const user = useUser();

	return (
		<ul className="flex flex-col gap-2">
			{comments.map((comment) => {
				const [firstName, lastName] = comment.creator.split(" ");

				return (
					<li
						key={comment.id}
						className={cx(
							"w-full md:w-3/5",
							comment.createBy === user.id ? "self-end" : "self-start",
						)}
					>
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-1">
										<Avatar className="size-8">
											<AvatarFallback>
												{firstName.charAt(0)}
												{lastName.charAt(0)}
											</AvatarFallback>
										</Avatar>

										<CardTitle>{comment.creator}</CardTitle>
									</div>

									{issue.project.role === "ADMIN" ||
									comment.createBy === user.id ? (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													size="icon"
													variant="outline"
													className="size-8"
												>
													<Icon name="ellipsis-horizontal">
														<span className="sr-only">Comments actions</span>
													</Icon>
												</Button>
											</DropdownMenuTrigger>

											<DropdownMenuContent>
												<DeleteCommentButton id={comment.id} />
											</DropdownMenuContent>
										</DropdownMenu>
									) : null}
								</div>
							</CardHeader>

							<CardContent>{comment.content}</CardContent>
						</Card>
					</li>
				);
			})}

			<li className="hidden first:list-item">
				<p className="text-center text-muted-foreground text-sm italic">
					Post a new comment.
				</p>
			</li>
		</ul>
	);
}

function DeleteCommentButton(props: { id: string }) {
	const fetcher = useFetcher<Action>();

	return (
		<fetcher.Form method="POST">
			<input type="hidden" name="id" value={props.id} />

			<DropdownMenuItem asChild>
				<button
					type="submit"
					name="intent"
					value={Intent.DeleteComment}
					className="w-full"
				>
					<Icon name="trash" className="mr-2" />
					Delete
				</button>
			</DropdownMenuItem>
		</fetcher.Form>
	);
}

function CommentsForm() {
	const fetcher = useFetcher<Action>();

	const [form, fields] = useZodForm({
		lastResult: fetcher.data,
		schema: FormSchema,
	});

	return (
		<fetcher.Form
			method="POST"
			className="flex flex-col gap-2"
			{...getFormProps(form)}
		>
			<input type="hidden" name="id" value={createId()} />

			<ConformTextarea meta={fields.content} />
			<Button
				type="submit"
				name="intent"
				value={Intent.CreateComment}
				className="ml-auto"
			>
				Post comment
			</Button>
		</fetcher.Form>
	);
}

function IssueMeta(props: { className?: string }) {
	return (
		<div
			className={cx("grid gap-4 items-center", props.className)}
			style={{ gridTemplateColumns: "auto 1fr" }}
		>
			<IssueOpenedByMeta />
			<IssueProjectMeta />
			<IssueStatusMeta />
			<IssuePriorityMeta />
		</div>
	);
}

function IssueProjectMeta() {
	const { issue } = useLoaderData<Loader>();
	const fetcher = useFetcher<Action>();

	const optmisticValue = fetcher.formData
		? String(fetcher.formData.get("projectId"))
		: issue.project.id;

	return (
		<>
			<span className="text-sm text-muted-foreground">Project</span>
			<fetcher.Form method="POST" className="max-w-48 w-full">
				<ProjectCombobox
					className="w-full"
					variant="secondary"
					initialValues={[issue.project]}
					value={optmisticValue}
					onValueChange={(projectId) => {
						const formData = new FormData();
						formData.set("intent", Intent.UpdateIssue);
						formData.set("projectId", projectId);

						fetcher.submit(formData, { method: "POST" });
					}}
				/>
			</fetcher.Form>
		</>
	);
}

function IssueOpenedByMeta() {
	const { issue } = useLoaderData<Loader>();

	return (
		<>
			<span className="text-sm text-muted-foreground">Opened by</span>
			<div>{issue.creator}</div>
		</>
	);
}

function IssueStatusMeta() {
	const { issue } = useLoaderData<Loader>();
	const fetcher = useFetcher<Action>();

	const optmisticStatus: IssueStatus = fetcher.formData
		? Number(fetcher.formData.get("status"))
		: issue.status;

	const config = ISSUE_STATUS_CONFIG[optmisticStatus];

	return (
		<>
			<span className="text-sm text-muted-foreground">Status</span>
			<fetcher.Form method="POST">
				<StatusDropdown
					value={`${optmisticStatus}`}
					onValueChange={(status) => {
						const formData = new FormData();
						formData.set("intent", Intent.UpdateIssue);
						formData.set("status", status);

						fetcher.submit(formData, { method: "POST" });
					}}
				>
					<Button size="sm" variant="secondary">
						<Icon name={config.icon} className="mr-2" />
						{config.label}
					</Button>
				</StatusDropdown>
			</fetcher.Form>
		</>
	);
}

function IssuePriorityMeta() {
	const { issue } = useLoaderData<Loader>();
	const fetcher = useFetcher<Action>();

	const optmisticPrio: IssuePriority = fetcher.formData
		? Number(fetcher.formData.get("priority"))
		: issue.priority;

	const config = ISSUE_PRIORITY_CONFIG[optmisticPrio];

	return (
		<>
			<span className="text-sm text-muted-foreground">Priority</span>
			<fetcher.Form method="POST">
				<PriorityDropdown
					value={`${optmisticPrio}`}
					onValueChange={(priority) => {
						const formData = new FormData();
						formData.set("intent", Intent.UpdateIssue);
						formData.set("priority", priority);

						fetcher.submit(formData, { method: "POST" });
					}}
				>
					<Button size="sm" variant="secondary">
						<Icon name={config.icon} className="mr-2" />
						{config.label}
					</Button>
				</PriorityDropdown>
			</fetcher.Form>
		</>
	);
}
