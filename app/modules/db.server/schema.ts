import { createId } from "@paralleldrive/cuid2";
import { type SQL, relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import {
	IssuePriority,
	IssueStatus,
	PROJECT_ROLES,
	type Role,
} from "../shared/utils";

const cuid = <T extends string>(name: T) =>
	text(name).primaryKey().$defaultFn(createId);
const defaultNow = <T extends string>(name: T) =>
	integer(name, { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

export type InsertUser = typeof User.$inferInsert;
export type SelectUser = typeof User.$inferSelect;
export const User = sqliteTable("users", {
	id: cuid("id"),
	userName: text("username").notNull().unique(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	fullName: text("full_name")
		.generatedAlwaysAs(
			(): SQL => sql`concat(${User.firstName},' ',${User.lastName})`,
		)
		.notNull(),
	password: text("password").notNull(),
});

export const UserRelations = relations(User, ({ many }) => ({
	projects: many(Project),
	issues: many(Issue),
	memberships: many(ProjectMember),
}));

export type InsertSession = typeof Session.$inferInsert;
export type SelectSession = typeof Session.$inferSelect;
export const Session = sqliteTable(
	"sessions",
	{
		id: text("id").notNull().primaryKey(),
		expiresAt: integer("expires_at").notNull(),
		userId: text("user_id")
			.references(() => User.id, { onDelete: "cascade", onUpdate: "cascade" })
			.notNull(),
	},
	(table) => ({
		idxSessionsUserId: index("idx_sessions_user_id").on(table.userId),
	}),
);

export type InsertProject = typeof Project.$inferInsert;
export type SelectProject = typeof Project.$inferSelect;
export const Project = sqliteTable(
	"projects",
	{
		id: cuid("id"),
		createdAt: defaultNow("created_at"),
		updatedAt: defaultNow("updated_at"),
		createdBy: text("created_by")
			.notNull()
			.references(() => User.id, { onDelete: "cascade", onUpdate: "cascade" }),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
	},
	(table) => ({
		idxProjectsCreatedBy: index("idx_projects_created_by").on(table.createdBy),
	}),
);

export const ProjectRelations = relations(Project, ({ one, many }) => ({
	createdBy: one(User, { fields: [Project.createdBy], references: [User.id] }),
	issues: many(Issue),
	members: many(ProjectMember),
}));

export type InsertProjectMember = typeof ProjectMember.$inferInsert;
export type SelectProjectMember = typeof ProjectMember.$inferSelect;
export const ProjectMember = sqliteTable(
	"project_members",
	{
		userId: text("user_id")
			.notNull()
			.references(() => User.id, { onDelete: "cascade", onUpdate: "cascade" }),
		projectId: text("project_id")
			.notNull()
			.references(() => Project.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
		invitedBy: text("invited_by").references(() => User.id, {
			onDelete: "set null",
			onUpdate: "cascade",
		}),
		role: text("role", {
			enum: Object.values(PROJECT_ROLES) as [string, ...Array<string>],
		})
			.notNull()
			.$type<Role>()
			.default("MEMBER"),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.projectId] }),
		idxProjectMembersUserId: index("idx_project_members_user_id").on(
			table.userId,
		),
		idxProjectMembersProjectId: index("idx_project_members_project_id").on(
			table.projectId,
		),
	}),
);

export const ProjectMemberRelations = relations(ProjectMember, ({ one }) => ({
	user: one(User, {
		fields: [ProjectMember.userId],
		references: [User.id],
		relationName: "member",
	}),
	project: one(Project, {
		fields: [ProjectMember.projectId],
		references: [Project.id],
	}),
	invitedByUser: one(User, {
		fields: [ProjectMember.invitedBy],
		references: [User.id],
		relationName: "invitee",
	}),
}));

export type InsertIssue = typeof Issue.$inferInsert;
export type SelectIssue = typeof Issue.$inferSelect;
export const Issue = sqliteTable(
	"issues",
	{
		id: cuid("id"),
		createdAt: defaultNow("created_at"),
		updatedAt: defaultNow("updated_at"),
		createdBy: text("created_by")
			.notNull()
			.references(() => User.id, { onDelete: "cascade", onUpdate: "cascade" }),
		projectId: text("project_id")
			.notNull()
			.references(() => Project.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
		title: text("title").notNull(),
		description: text("description").default(""),
		status: integer("status")
			.$type<IssueStatus>()
			.notNull()
			.default(IssueStatus.Backlog),
		priority: integer("priority")
			.$type<IssuePriority>()
			.notNull()
			.default(IssuePriority.None),
	},
	(table) => ({
		idxIssuesCreatedBy: index("idx_issues_created_by").on(table.createdBy),
		idxIssuesProjectId: index("idx_issues_project_id").on(table.projectId),
		idxIssuesStatus: index("idx_issues_status").on(table.status),
		idxIssuesPriority: index("idx_issues_priority").on(table.priority),
	}),
);

export const IssueRelations = relations(Issue, ({ one, many }) => ({
	createdBy: one(User, {
		fields: [Issue.createdBy],
		references: [User.id],
	}),
	project: one(Project, {
		fields: [Issue.projectId],
		references: [Project.id],
	}),
	comments: many(Comment),
}));

export type InsertComment = typeof Comment.$inferInsert;
export type SelectComment = typeof Comment.$inferSelect;
export const Comment = sqliteTable(
	"comments",
	{
		id: cuid("id"),
		createdAt: defaultNow("created_at"),
		updatedAt: defaultNow("updated_at"),
		issueId: text("issue_id")
			.notNull()
			.references(() => Issue.id, { onDelete: "cascade", onUpdate: "cascade" }),
		createdBy: text("created_by")
			.notNull()
			.references(() => User.id, { onDelete: "cascade", onUpdate: "cascade" }),
		content: text("content").default("").notNull(),
	},
	(table) => ({
		idxCommentsIssueId: index("idx_comments_issue_id").on(table.issueId),
		idxCommentsCreatedBy: index("idx_comments_created_by").on(table.createdBy),
	}),
);

export const CommentRelations = relations(Comment, ({ one }) => ({
	createdBy: one(User, {
		fields: [Comment.createdBy],
		references: [User.id],
	}),
	issue: one(Issue, {
		fields: [Comment.issueId],
		references: [Issue.id],
	}),
}));
