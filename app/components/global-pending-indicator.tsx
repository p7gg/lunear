import { useNavigation } from "@remix-run/react";
import { cx } from "~/modules/shared/utils";

export function GlobalPendingIndicator() {
	const navigation = useNavigation();
	const pending = navigation.state !== "idle";

	return (
		<div
			className={cx("fixed top-0 left-0 right-0 z-20", { hidden: !pending })}
		>
			<div className="h-0.5 w-full overflow-hidden">
				<div className="animate-progress w-full h-full bg-muted-foreground origin-left-right" />
			</div>
		</div>
	);
}
