import { subscribeToSchemeChange } from "@epic-web/client-hints/color-scheme";
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node";
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useNavigation,
	useRevalidator,
} from "@remix-run/react";
import { parseAcceptLanguage } from "intl-parse-accept-language";
import { useEffect } from "react";
import { getToast } from "remix-toast";
import { iconsHref } from "~/components/icons/icons";
import { useNonce } from "~/components/nonce-provider";
import { Toaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useToast } from "~/components/ui/use-toast";
import { type Theme, getTheme } from "~/modules/shared/utils.server";
import { useTheme } from "~/routes/resources+/theme-switch";
import tailwindHref from "~/tailwind.css?url";
import { LoaderBar } from "./components/global-pending-indicator";
import {
	APP_NAME,
	getClientHintCheckScript,
	getHints,
} from "./modules/shared/utils";

export const links: LinksFunction = () => [
	// Preload svg sprite as a resource to avoid render blocking
	{ rel: "preload", href: iconsHref, as: "image" },
	{ rel: "stylesheet", href: tailwindHref, as: "style" },
];

export type Loader = typeof loader;
export async function loader({ request, context }: LoaderFunctionArgs) {
	const { toast, headers } = await getToast(request);

	const [locale = "en-US"] = parseAcceptLanguage(
		request.headers.get("accept-language"),
		{ validate: Intl.DateTimeFormat.supportedLocalesOf },
	);

	return json(
		{
			toast,
			user: context.user,
			requestInfo: {
				hints: getHints(request),
				locale,
				path: new URL(request.url).pathname,
				userPrefs: {
					theme: getTheme(request),
				},
			},
		},
		{ headers },
	);
}

function Document({
	children,
	nonce,
	theme = "dark",
}: {
	children: React.ReactNode;
	nonce: string;
	theme?: Theme;
}) {
	return (
		<html lang="en" className={theme}>
			<head>
				<ClientHintCheck nonce={nonce} />
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<meta name="description" content={`Welcome to ${APP_NAME}!`} />
				<Links />
			</head>
			<body>
				<GlobalPendingIndicator />
				{children}
				<Toaster />
				<ScrollRestoration nonce={nonce} />
				<Scripts nonce={nonce} />
			</body>
		</html>
	);
}

export default function App() {
	const data = useLoaderData<Loader>();

	const { toast } = useToast();
	const nonce = useNonce();
	const theme = useTheme();

	useEffect(() => {
		if (data.toast) {
			const { type, message, description } = data.toast;
			const title = message && description ? message : undefined;

			toast({
				title,
				description: description || message,
				variant: type,
			});
		}
	}, [toast, data.toast]);

	return (
		<Document nonce={nonce} theme={theme}>
			<TooltipProvider>
				<Outlet />
			</TooltipProvider>
		</Document>
	);
}

function GlobalPendingIndicator() {
	const navigation = useNavigation();
	const pending = navigation.state !== "idle";

	return <LoaderBar className={!pending ? "hidden" : undefined} />;
}

function ClientHintCheck({ nonce }: { nonce: string }) {
	const { revalidate } = useRevalidator();
	useEffect(() => subscribeToSchemeChange(() => revalidate()), [revalidate]);

	return (
		<script
			nonce={nonce}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
			dangerouslySetInnerHTML={{
				__html: getClientHintCheckScript(),
			}}
		/>
	);
}
