import type { MetaFunction } from "@remix-run/node";
import { title } from "~/modules/shared/utils";

export const meta: MetaFunction = () => {
	return [{ title: title() }];
};

export default function Route() {
	return <div className="container">App</div>;
}
