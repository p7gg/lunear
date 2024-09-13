import { z } from "zod";
import { IssuePriority, IssueStatus } from "~/modules/shared/utils";

export enum Intent {
	CreateIssue = "create_issue",
	DeleteIssue = "delete_issue",
	UpdateIssue = "update_issue",
}

const StatusSchema = z.number().refine((s) => IssueStatus[s], "Invalid status");
const PrioritySchema = z
	.number()
	.refine((p) => IssuePriority[p], "Invalid priority");

export type FormSchema = z.input<typeof FormSchema>;
export const FormSchema = z.discriminatedUnion("intent", [
	z.object({
		intent: z.literal(Intent.CreateIssue),
		id: z.string().optional(),
		projectId: z.string().min(1),
		status: StatusSchema,
		priority: PrioritySchema,
		title: z.string().min(1),
		description: z.string().optional(),
	}),
	z.object({
		intent: z.literal(Intent.DeleteIssue),
		projectId: z.string(),
		id: z.string(),
	}),
	z.object({
		intent: z.literal(Intent.UpdateIssue),
		id: z.string(),
		projectId: z.string().min(1),
		ownerId: z.string().min(1).optional(),
		priority: PrioritySchema.optional(),
		status: StatusSchema.optional(),
		title: z.string().min(1).optional(),
		description: z.string().min(1).optional(),
	}),
]);
