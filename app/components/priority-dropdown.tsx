import type { DropdownMenuRadioGroupProps } from "@radix-ui/react-dropdown-menu";
import { ISSUE_PRIORITY_CONFIG } from "~/modules/shared/utils";
import { Icon } from "./icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface PriorityDropdownProps extends DropdownMenuRadioGroupProps {
	children: React.ReactNode;
	indicatorPosition?: "left" | "right";
}
export function PriorityDropdown({
	children,
	indicatorPosition = "right",
	...props
}: PriorityDropdownProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup {...props}>
					{Object.entries(ISSUE_PRIORITY_CONFIG).map(([value, config]) => (
						<DropdownMenuRadioItem
							key={value}
							indicatorPosition="right"
							value={value}
						>
							<Icon name={config.icon} className="mr-2" />
							{config.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
