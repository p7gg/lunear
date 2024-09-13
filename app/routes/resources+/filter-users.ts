import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { db } from "~/modules/db.server/client";
import { ProjectMember } from "~/modules/db.server/schema";
import { requireAuth } from "~/modules/shared/utils.server";

const usersQuery = db.query.User.findMany({
	where(fields, { like, sql }) {
		return like(fields.firstName, sql.placeholder("q"));
	},
	columns: {
		password: false,
	},
}).prepare();

const usersProjectQuery = db.query.User.findMany({
	where(fields, { and, like, eq, sql, notExists }) {
		return and(
			like(fields.firstName, sql.placeholder("q")),
			notExists(
				db
					.select()
					.from(ProjectMember)
					.where(
						and(
							eq(ProjectMember.projectId, sql.placeholder("projectId")),
							eq(ProjectMember.userId, fields.id),
						),
					),
			), // Exclude users already in the project,
		);
	},
	columns: {
		password: false,
	},
}).prepare();

export type Loader = typeof loader;
export async function loader({ request, context }: LoaderFunctionArgs) {
	requireAuth(context);

	const url = new URL(request.url);
	const q = url.searchParams.get("q");
	const projectId = url.searchParams.get("projectId");

	return json(
		q
			? projectId
				? await usersProjectQuery.all({ q: `%${q}%`, projectId })
				: await usersQuery.all({ q: `%${q}%` })
			: [],
	);
}
