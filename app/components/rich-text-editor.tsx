import TextAlign from "@tiptap/extension-text-align";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cx } from "~/modules/shared/utils";
import { Icon } from "./icons/icons";
import { Separator } from "./ui/separator";
import { Toggle } from "./ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

const extensions = [
	StarterKit.configure({
		orderedList: {
			HTMLAttributes: {
				class: "list-decimal pl-4",
			},
		},
		bulletList: {
			HTMLAttributes: {
				class: "list-disc pl-4",
			},
		},
	}),
	TextAlign.configure({
		types: ["heading", "paragraph"],
	}),
];
export function RichTextEditor(props: {
	className?: string;
	value: string;
	onChange?: (content: string) => void;
	onBlur?: (content: string) => void;
	onFocus?: (content: string) => void;
	placeholder?: string;
}) {
	const editor = useEditor({
		editorProps: {
			attributes: {
				class: cx(
					"h-[150px] w-full px-3 py-2 text-sm prose-zinc dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 overflow-auto",
					props.className,
				),
			},
		},
		extensions,
		content: props.value,
		onBlur: ({ editor }) => {
			props.onBlur?.(editor.getHTML());
		},
		onFocus: ({ editor }) => {
			props.onFocus?.(editor.getHTML());
		},
		onUpdate: ({ editor }) => {
			props.onChange?.(editor.getHTML());
		},
	});

	return (
		<div className="rounded-md border border-input focus-within:outline outline-offset-2 outline-2 outline-ring divide-y">
			{editor ? <Toolbar editor={editor} /> : null}
			<EditorContent editor={editor} />
		</div>
	);
}

const HEADINGS = [1, 2, 3, 4, 5, 6] as const;
const ALIGNMENTS = ["left", "center", "right", "justify"] as const;

function Toolbar(props: { editor: Editor }) {
	return (
		<div className="p-1 flex items-center flex-wrap gap-1">
			<Toggle
				size="sm"
				aria-label="Toggle bold"
				onPressedChange={() => props.editor.chain().focus().toggleBold().run()}
				pressed={props.editor.isActive("bold")}
			>
				<Icon name="bold" />
			</Toggle>

			<Toggle
				size="sm"
				aria-label="Toggle italic"
				onPressedChange={() =>
					props.editor.chain().focus().toggleItalic().run()
				}
				pressed={props.editor.isActive("italic")}
			>
				<Icon name="italic" />
			</Toggle>

			<Toggle
				size="sm"
				aria-label="Toggle strikethrough"
				onPressedChange={() =>
					props.editor.chain().focus().toggleStrike().run()
				}
				pressed={props.editor.isActive("strike")}
			>
				<Icon name="strikethrough" />
			</Toggle>

			<Separator orientation="vertical" className="mx-2" />

			{HEADINGS.map((level) => (
				<Toggle
					key={level}
					size="sm"
					aria-label={`Toggle heading ${level}`}
					onPressedChange={() =>
						props.editor.chain().focus().toggleHeading({ level }).run()
					}
					pressed={props.editor.isActive("heading", { level })}
				>
					<Icon name={`heading-${level}`} />
				</Toggle>
			))}

			<Separator orientation="vertical" className="mx-2" />

			<ToggleGroup
				type="single"
				defaultValue="left"
				onValueChange={(alignment) => {
					if (alignment) {
						props.editor.commands.setTextAlign(alignment);
					} else {
						props.editor.commands.unsetTextAlign();
					}
				}}
			>
				{ALIGNMENTS.map((a) => (
					<ToggleGroupItem size="sm" key={a} value={a}>
						<Icon name={`align-${a}`} />
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}
