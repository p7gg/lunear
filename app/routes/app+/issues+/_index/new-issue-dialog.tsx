import {
	type FieldMetadata,
	getFormProps,
	getInputProps,
	getTextareaProps,
	useInputControl,
} from "@conform-to/react";
import { createId } from "@paralleldrive/cuid2";
import {
	Await,
	useFetcher,
	useLoaderData,
	useSearchParams,
} from "@remix-run/react";
import { useId, useState } from "react";
import { Icon } from "~/components/icons";
import { PriorityDropdown } from "~/components/priority-dropdown";
import { StatusDropdown } from "~/components/status-dropdown";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { DialogFooter, DialogHeader } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
	ISSUE_PRIORITY_CONFIG,
	ISSUE_STATUS_CONFIG,
	IssuePriority,
	IssueStatus,
	useZodForm,
} from "~/modules/shared/utils";
import { ProjectCombobox } from "~/routes/resources+/filter-projects";
import type { Action as IssuesAction, Loader as IssuesLoader } from "./_route";
import { FormSchema, Intent } from "./shared";

export function NewIssueDialog(props: { children: React.ReactNode }) {
	const formId = useId();
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{props.children}</DialogTrigger>

			<DialogContent className="sm:max-w-[700px]">
				<DialogHeader>
					<DialogTitle>New issue</DialogTitle>
					<DialogDescription className="sr-only">
						Issue a new ticket here. Click save when you're done.
					</DialogDescription>
				</DialogHeader>

				<IssueForm id={formId} onSubmit={() => setIsOpen(false)} />

				<DialogFooter>
					<Button
						type="submit"
						form={formId}
						name="intent"
						value={Intent.CreateIssue}
					>
						Save issue
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function IssueForm(props: { id: string; onSubmit?: () => void }) {
	const fetcher = useFetcher<IssuesAction>();
	const [searchParams] = useSearchParams();

	const [form, fields] = useZodForm({
		id: props.id,
		lastResult: fetcher.data,
		schema: FormSchema,
		defaultValue: {
			status: IssueStatus.Backlog,
			priority: IssuePriority.None,
			projectId: searchParams.get("project"),
		},
		onSubmit: props.onSubmit,
	});

	return (
		<fetcher.Form
			method="POST"
			{...getFormProps(form)}
			className="flex flex-col gap-2"
		>
			<input type="hidden" name="id" value={createId()} />

			<div className="flex items-center gap-2">
				<StatusPicker meta={fields.status} />

				<Input
					placeholder="Issue title"
					className="aria-invalid:border-error text-xl font-medium"
					{...getInputProps(fields.title, { type: "text" })}
				/>
			</div>

			<Textarea
				placeholder="Add description..."
				className="aria-invalid:border-error"
				{...getTextareaProps(fields.description)}
			/>

			<div className="flex items-center gap-2">
				<PriorityPicker meta={fields.priority} />
				<ProjectSelect meta={fields.projectId} />
			</div>
		</fetcher.Form>
	);
}

function ProjectSelect(props: { meta: FieldMetadata<string, FormSchema> }) {
	const { projectsPromise } = useLoaderData<IssuesLoader>();

	const control = useInputControl(props.meta);

	return (
		<Await resolve={projectsPromise}>
			{(projects) => {
				return (
					<>
						<input
							{...getInputProps(props.meta, { type: "hidden" })}
							className="peer"
						/>
						<ProjectCombobox
							value={control.value || null}
							onValueChange={control.change}
							initialValues={projects}
						/>
					</>
				);
			}}
		</Await>
	);
}

function StatusPicker(props: { meta: FieldMetadata<IssueStatus, FormSchema> }) {
	const control = useInputControl(props.meta);

	const selectedStatus =
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		ISSUE_STATUS_CONFIG[+control.value! as keyof typeof ISSUE_STATUS_CONFIG];

	return (
		<StatusDropdown value={control.value} onValueChange={control.change}>
			<Button variant="outline" size="icon" name="status" value={control.value}>
				<Icon
					name={selectedStatus.icon}
					className={
						"color" in selectedStatus ? selectedStatus.color : undefined
					}
				>
					<span className="sr-only">Select a status</span>
				</Icon>
			</Button>
		</StatusDropdown>
	);
}

function PriorityPicker(props: {
	meta: FieldMetadata<IssuePriority, FormSchema>;
}) {
	const control = useInputControl(props.meta);

	const selectedPriority =
		ISSUE_PRIORITY_CONFIG[
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			+control.value! as keyof typeof ISSUE_PRIORITY_CONFIG
		];

	return (
		<PriorityDropdown value={control.value} onValueChange={control.change}>
			<Button variant="outline" name="priority" value={control.value}>
				<Icon name={selectedPriority.icon} className="mr-2" />
				{selectedPriority.label}
			</Button>
		</PriorityDropdown>
	);
}
