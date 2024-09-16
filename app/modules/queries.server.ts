import { and, eq } from "drizzle-orm";
import type { SetOptional } from "type-fest";
import { db } from "./db.server";
import {
	Comment,
	type InsertComment,
	type InsertIssue,
	type InsertProject,
	type InsertProjectMember,
	type InsertUser,
	Issue,
	Project,
	ProjectMember,
	User,
} from "./db.server/schema";
import type { Role } from "./shared/utils";
import { type AuthenticatedContext, safeQuery } from "./shared/utils.server";
import type { RequireOnly } from "./types";

export const projectMemberQuery = db.query.ProjectMember.findFirst({
	where(fields, { and, eq, sql }) {
		return and(
			eq(fields.projectId, sql.placeholder("projectId")),
			eq(fields.userId, sql.placeholder("userId")),
		);
	},
}).prepare();

export async function createUser(payload: InsertUser) {
	const hashedPassword = await Bun.password.hash(payload.password);

	return safeQuery(
		db
			.insert(User)
			.values({
				userName: payload.userName,
				password: hashedPassword,
				firstName: payload.firstName,
				lastName: payload.lastName,
			})
			.returning({ id: User.id })
			.then(([user]) => user),
	);
}

export async function getUserByUserName(userName: string) {
	return safeQuery(
		db.query.User.findFirst({
			where(fields, { eq }) {
				return eq(fields.userName, userName);
			},
		}),
	);
}

export async function createProject(
	context: AuthenticatedContext,
	payload: SetOptional<InsertProject, "createdBy">,
) {
	return safeQuery(
		db.transaction(async (tx) => {
			const [project] = await tx
				.insert(Project)
				.values({
					id: payload.id,
					createdAt: payload.createdAt,
					updatedAt: payload.updatedAt,
					createdBy: context.user.id,
					name: payload.name,
					description: payload.description,
				})
				.returning({ id: Project.id });

			if (!project.id) {
				tx.rollback();
			}

			await tx.insert(ProjectMember).values({
				projectId: project.id,
				userId: context.user.id,
				role: "ADMIN",
			});

			return project;
		}),
	);
}

export async function deleteProjectById(
	_context: AuthenticatedContext,
	id: string,
) {
	return safeQuery(db.delete(Project).where(eq(Project.id, id)));
}

export async function updateProject(
	_context: AuthenticatedContext,
	payload: RequireOnly<InsertProject, "id">,
) {
	return safeQuery(
		db
			.update(Project)
			.set({
				name: payload.name,
				description: payload.description,
				createdBy: payload.createdBy,
				createdAt: payload.createdAt,
				updatedAt: payload.updatedAt ?? new Date(),
			})
			.where(eq(Project.id, payload.id)),
	);
}

export async function createIssue(
	context: AuthenticatedContext,
	payload: SetOptional<InsertIssue, "createdBy">,
) {
	return safeQuery(
		db.insert(Issue).values({
			id: payload.id,
			createdAt: payload.createdAt,
			updatedAt: payload.updatedAt,
			createdBy: context.user.id,
			projectId: payload.projectId,
			priority: payload.priority,
			status: payload.status,
			title: payload.title,
			description: payload.description,
		}),
	);
}

export async function deleteIssueById(
	_context: AuthenticatedContext,
	payload: { id: string },
) {
	return safeQuery(db.delete(Issue).where(eq(Issue.id, payload.id)));
}

export async function updateIssueById(
	_context: AuthenticatedContext,
	payload: RequireOnly<InsertIssue, "id">,
) {
	return safeQuery(
		db
			.update(Issue)
			.set({
				createdAt: payload.createdAt,
				updatedAt: payload.updatedAt ?? new Date(),
				createdBy: payload.createdBy,
				projectId: payload.projectId,
				priority: payload.priority,
				status: payload.status,
				title: payload.title,
				description: payload.description,
			})
			.where(eq(Issue.id, payload.id)),
	);
}

export async function addNewProjectMember(
	context: AuthenticatedContext,
	payload: InsertProjectMember,
) {
	return safeQuery(
		db.insert(ProjectMember).values({
			projectId: payload.projectId,
			userId: payload.userId,
			invitedBy: payload.invitedBy || context.user.id,
			role: payload.role,
		}),
	);
}

export async function updateMemberRole(
	_context: AuthenticatedContext,
	payload: { userId: string; projectId: string; role: Role },
) {
	return safeQuery(
		db
			.update(ProjectMember)
			.set({
				role: payload.role,
			})
			.where(
				and(
					eq(ProjectMember.userId, payload.userId),
					eq(ProjectMember.projectId, payload.projectId),
				),
			),
	);
}

export async function removeProjectMember(
	_context: AuthenticatedContext,
	payload: {
		userId: string;
		projectId: string;
	},
) {
	return safeQuery(
		db
			.delete(ProjectMember)
			.where(
				and(
					eq(ProjectMember.userId, payload.userId),
					eq(ProjectMember.projectId, payload.projectId),
				),
			),
	);
}

export async function createComment(payload: InsertComment) {
	return safeQuery(
		db.insert(Comment).values({
			id: payload.id,
			createdAt: payload.createdAt,
			updatedAt: payload.updatedAt,
			createdBy: payload.createdBy,
			issueId: payload.issueId,
			content: payload.content,
		}),
	);
}

export async function deleteCommentById(payload: { id: string }) {
	return safeQuery(db.delete(Comment).where(eq(Comment.id, payload.id)));
}
