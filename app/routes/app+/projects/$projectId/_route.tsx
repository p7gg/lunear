import { getFormProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import { invariantResponse } from "@epic-web/invariant";
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node";
import { useFetcher, useFetchers, useLoaderData } from "@remix-run/react";
import { sql } from "drizzle-orm";
import { useRef, useState } from "react";
import { jsonWithError } from "remix-toast";
import { z } from "zod";
import { Icon } from "~/components/icons/icons";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import { ConformInput } from "~/components/ui/input";
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
import { ConformTextarea } from "~/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { db } from "~/modules/db.server/client";
import {
	addNewProjectMember,
	projectMemberQuery,
	removeProjectMember,
	updateMemberRole,
	updateProject,
} from "~/modules/queries.server";
import {
	PROJECT_ROLES,
	type Role,
	title,
	useDebouncedCallback,
	useRequestInfo,
	useZodForm,
} from "~/modules/shared/utils";
import {
	badRequest,
	notFound,
	requireAuth,
	safeQuery,
	unauthorized,
} from "~/modules/shared/utils.server";
import { useUser } from "~/modules/user";
import type { Loader as FilterUsersLoader } from "~/routes/resources+/filter-users";

enum Intent {
	UpdateProject = "update_project",
	AddNewMember = "add_new_member",
	UpdateMemberRole = "update_member_role",
	RemoveMember = "remove_member",
}
const FormSchema = z.discriminatedUnion("intent", [
	z.object({
		intent: z.literal(Intent.UpdateProject),
		name: z.string().min(1),
		description: z.string().optional(),
	}),
	z.object({
		intent: z.literal(Intent.AddNewMember),
		userId: z.string(),
		invitedBy: z.string().optional(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
	}),
	z.object({
		intent: z.literal(Intent.UpdateMemberRole),
		userId: z.string(),
		role: z.nativeEnum(PROJECT_ROLES),
	}),
	z.object({
		intent: z.literal(Intent.RemoveMember),
		userId: z.string(),
	}),
]);
const projectQuery = db.query.Project.findFirst({
	columns: {
		id: false,
	},
	where(fields, { eq }) {
		return eq(fields.id, sql.placeholder("projectId"));
	},
	with: {
		members: {
			columns: {
				role: true,
				userId: true,
			},
			with: {
				user: {
					columns: {
						firstName: true,
						lastName: true,
					},
				},
			},
		},
	},
}).prepare();
function useMembers() {
	const { project } = useLoaderData<Loader>();
	const fetchers = useFetchers();

	return [
		...fetchers
			.reduce(
				(acc, fetcher) => {
					if (fetcher.formData) {
						const sub = parseWithZod(fetcher.formData, { schema: FormSchema });

						if (sub.status === "success") {
							const payload = sub.value;
							switch (payload.intent) {
								case Intent.AddNewMember: {
									payload.firstName &&
										payload.lastName &&
										acc.set(payload.userId, {
											role: "MEMBER",
											userId: payload.userId,
											user: {
												firstName: payload.firstName,
												lastName: payload.lastName,
											},
										});
									break;
								}
								case Intent.UpdateMemberRole: {
									const member = acc.get(payload.userId);
									if (member) {
										member.role = payload.role;
									}
									break;
								}
								case Intent.RemoveMember: {
									acc.delete(payload.userId);
									break;
								}
								default:
									break;
							}
						}
					}

					return acc;
				},
				new Map(project.members.map((m) => [m.userId, m])),
			)
			.values(),
	];
}

export const meta: MetaFunction<Loader> = ({ data }) => [
	{ title: title(data?.project.name) },
];

export type Loader = typeof loader;
export async function loader({ params, context }: LoaderFunctionArgs) {
	requireAuth(context);

	const { projectId } = params;
	invariantResponse(projectId, "Missing Project ID");
	const [[project, projectError], [projectMember, projectMemberError]] =
		await Promise.all([
			safeQuery(projectQuery.execute({ projectId, userId: context.user.id })),
			safeQuery(projectMemberQuery.get({ projectId, userId: context.user.id })),
		]);

	if (projectError || projectMemberError) {
		throw projectError || projectMemberError;
	}

	if (!project || !projectMember || projectMember.role !== "ADMIN") {
		throw notFound();
	}

	return json({
		projectId,
		project,
		projectMember,
	});
}

export type Action = typeof action;
export async function action({ request, params, context }: ActionFunctionArgs) {
	requireAuth(context);

	const { projectId } = params;
	invariantResponse(projectId, "Missing Project ID");

	const projectMember = await projectMemberQuery.get({
		projectId,
		userId: context.user.id,
	});

	if (!projectMember || projectMember.role !== "ADMIN") {
		throw unauthorized();
	}

	const formData = await request.formData();
	const sub = parseWithZod(formData, { schema: FormSchema });

	if (sub.status !== "success") {
		return json(sub.reply());
	}

	let error: Error | null = null;
	const payload = sub.value;

	switch (payload.intent) {
		case Intent.UpdateProject: {
			const [, resError] = await updateProject(context, {
				id: projectId,
				name: payload.name,
				description: payload.description,
			});
			error = resError;

			break;
		}
		case Intent.AddNewMember: {
			const [, resError] = await addNewProjectMember(context, {
				projectId,
				userId: payload.userId,
				invitedBy: payload.invitedBy,
			});
			error = resError;

			break;
		}
		case Intent.UpdateMemberRole: {
			const [, resError] = await updateMemberRole(context, {
				projectId,
				userId: payload.userId,
				role: payload.role,
			});
			error = resError;

			break;
		}
		case Intent.RemoveMember: {
			const [, resError] = await removeProjectMember(context, {
				projectId,
				userId: payload.userId,
			});
			error = resError;
			break;
		}
		default: {
			throw badRequest("Invalid intent");
		}
	}

	return error
		? jsonWithError(null, {
				message: error.message,
			})
		: null;
}

export default function Route() {
	return (
		<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 container py-4">
			<div className="flex flex-col gap-4">
				<div className="border rounded p-4 py-6 relative">
					<span className="absolute top-0 left-2 text-sm font-medium -translate-y-1/2 px-2 bg-[#fbfbfb] dark:bg-[#151517]">
						Info
					</span>

					<ProjectConfigForm />
				</div>

				<div>
					<ProjectDate param="createdAt" />
					<ProjectDate param="updatedAt" />
				</div>
			</div>

			<div className="lg:col-span-2 rounded bg-muted/50 border p-4 flex flex-col gap-2">
				<div className="flex items-center">
					<AddMemberCombobox />
				</div>

				<MembersList />
			</div>
		</div>
	);
}

function ProjectDate(props: { param: "createdAt" | "updatedAt" }) {
	const { project } = useLoaderData<Loader>();

	const requestInfo = useRequestInfo();
	const locale = requestInfo.locale;
	const timeZone = requestInfo.hints.timeZone;

	return (
		<p className="text-xs text-muted-foreground font-semibold italic">
			{props.param === "createdAt" ? "Created at: " : "Updated at: "}
			{new Date(project[props.param]).toLocaleString(locale, {
				timeZone,
			})}
		</p>
	);
}

function ProjectConfigForm() {
	const { project } = useLoaderData<Loader>();
	const fetcher = useFetcher();

	const [form, fields] = useZodForm({
		schema: FormSchema,
		defaultValue: {
			name: project.name,
			description: project.description,
		},
	});

	return (
		<fetcher.Form
			method="POST"
			className="flex flex-col gap-2"
			{...getFormProps(form)}
		>
			<input type="hidden" name="intent" value={Intent.UpdateProject} />
			<ConformInput label="Name" meta={fields.name} />
			<ConformTextarea label="Description" meta={fields.description} />
			<Button type="submit" className="ml-auto">
				Save
			</Button>
		</fetcher.Form>
	);
}

function AddMemberCombobox() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button className="ml-auto">
					<Icon name="user-plus" className="mr-2" />
					Add member
				</Button>
			</PopoverTrigger>

			<PopoverContent className="p-0" align="end">
				<UserSearchList onSelect={() => setIsOpen(false)} />
			</PopoverContent>
		</Popover>
	);
}

function UserSearchList(props: { onSelect?: (userId: string) => void }) {
	const { projectId } = useLoaderData<Loader>();
	const searchFetcher = useFetcher<FilterUsersLoader>();
	const addMemberFetcher = useFetcher<Action>();

	const formRef = useRef<HTMLFormElement>(null);
	const [search, setSearch] = useState("");

	const handleSubmitSearch = useDebouncedCallback(() => {
		searchFetcher.submit(formRef.current);
	}, 500);

	return (
		<Command shouldFilter={false}>
			<searchFetcher.Form
				ref={formRef}
				method="GET"
				action="/resources/filter-users"
			>
				<input type="hidden" name="projectId" value={projectId} />
				<CommandInput
					name="q"
					placeholder="Search for users..."
					value={search}
					onValueChange={(v) => {
						setSearch(v);
						handleSubmitSearch();
					}}
				/>
			</searchFetcher.Form>

			<CommandList>
				<CommandEmpty>
					{search && searchFetcher.data
						? "No users found."
						: "Search for users."}
				</CommandEmpty>

				<CommandGroup>
					{searchFetcher.data?.map((user) => (
						<CommandItem
							key={user.id}
							value={user.id}
							onSelect={(userId) => {
								const formData = new FormData();
								formData.append("intent", Intent.AddNewMember);
								formData.append("userId", userId);
								formData.append("firstName", user.firstName);
								formData.append("lastName", user.lastName);

								addMemberFetcher.submit(formData, { method: "POST" });
								props.onSelect?.(userId);
							}}
						>
							{user.userName} - {user.firstName} {user.lastName}
						</CommandItem>
					))}
				</CommandGroup>
			</CommandList>
		</Command>
	);
}

function MembersList() {
	const { project, projectMember } = useLoaderData<Loader>();

	const user = useUser();
	const members = useMembers();

	const userOwnsProject = project.createdBy === user.id;
	const userAdminsProject = projectMember.role === "ADMIN";

	return (
		<ul className="divide-y">
			{members.map((member) => {
				const isMemberOwner = member.userId === project.createdBy;
				const isMemberAdmin = member.role === "ADMIN";
				const isMemberTheCurrentUser = member.userId === user.id;

				const isMemberMember = member.role === "MEMBER";

				return (
					<li key={member.userId}>
						<div className="flex items-center py-2 px-2 gap-2">
							<Avatar className="hidden md:inline-block">
								<AvatarFallback>
									{member.user.firstName.charAt(0)}
									{member.user.lastName.charAt(0)}
								</AvatarFallback>
							</Avatar>

							<span className="text-sm font-medium line-clamp-1 mr-auto">
								{member.user.firstName} {member.user.lastName}
							</span>

							{(userOwnsProject && !isMemberTheCurrentUser) ||
							(userAdminsProject && isMemberMember) ? (
								<MemberRoleSelect id={member.userId} role={member.role} />
							) : isMemberOwner ? (
								<Badge>Owner</Badge>
							) : isMemberAdmin ? (
								<Badge>Admin</Badge>
							) : null}

							{(userOwnsProject && !isMemberTheCurrentUser) ||
							(userAdminsProject && isMemberMember) ? (
								<RemoveMemberButton id={member.userId} />
							) : null}
						</div>
					</li>
				);
			})}
		</ul>
	);
}

function MemberRoleSelect(props: { id: string; role: Role }) {
	const fetcher = useFetcher();

	return (
		<fetcher.Form method="POST">
			<Select
				name="role"
				value={props.role}
				onValueChange={(role) => {
					const formData = new FormData();
					formData.set("intent", Intent.UpdateMemberRole);
					formData.set("userId", props.id);
					formData.set("role", role);

					fetcher.submit(formData, { method: "POST" });
				}}
			>
				<SelectTrigger className="w-28">
					<SelectValue placeholder="Select a Role" />
				</SelectTrigger>

				<SelectContent>
					{Object.entries(PROJECT_ROLES).map(([label, value]) => (
						<SelectItem key={value} value={value}>
							{label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</fetcher.Form>
	);
}

function RemoveMemberButton(props: { id: string }) {
	const fetcher = useFetcher();

	return (
		<fetcher.Form method="POST">
			<input type="hidden" name="userId" value={props.id} />

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="submit"
						variant="ghost"
						size="icon"
						name="intent"
						value={Intent.RemoveMember}
					>
						<Icon name="user-minus">
							<span className="sr-only">Remove member</span>
						</Icon>
					</Button>
				</TooltipTrigger>
				<TooltipContent>Remove member</TooltipContent>
			</Tooltip>
		</fetcher.Form>
	);
}
