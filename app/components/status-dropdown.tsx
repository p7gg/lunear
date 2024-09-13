import type { DropdownMenuRadioGroupProps } from "@radix-ui/react-dropdown-menu";
import { ISSUE_STATUS_CONFIG } from "~/modules/shared/utils";
import { Icon } from "./icons/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface StatusDropdownProps extends DropdownMenuRadioGroupProps {
	children: React.ReactNode;
	indicatorPosition?: "left" | "right";
}
export function StatusDropdown({
	children,
	indicatorPosition = "right",
	...props
}: StatusDropdownProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuRadioGroup {...props}>
					{Object.entries(ISSUE_STATUS_CONFIG).map(([value, config]) => (
						<DropdownMenuRadioItem
							key={value}
							indicatorPosition={indicatorPosition}
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
