import { getHintUtils } from "@epic-web/client-hints";
import {
	clientHint as colorSchemeHint,
	subscribeToSchemeChange,
} from "@epic-web/client-hints/color-scheme";
import { clientHint as timeZoneHint } from "@epic-web/client-hints/time-zone";
import { invariant } from "@epic-web/invariant";
import { useRevalidator, useRouteLoaderData } from "@remix-run/react";
import { useEffect } from "react";
import type { Loader } from "~/root";

const hintsUtils = getHintUtils({
	theme: colorSchemeHint,
	timeZone: timeZoneHint,
	// add other hints here
});

export const { getHints } = hintsUtils;

export function useRequestInfo() {
	const data = useRouteLoaderData<Loader>("root");
	invariant(data?.requestInfo, "No requestInfo found in root loader");

	return data.requestInfo;
}

export function useHints() {
	const requestInfo = useRequestInfo();
	return requestInfo.hints;
}

export function ClientHintCheck({ nonce }: { nonce: string }) {
	const { revalidate } = useRevalidator();
	useEffect(() => subscribeToSchemeChange(() => revalidate()), [revalidate]);

	return (
		<script
			nonce={nonce}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
			dangerouslySetInnerHTML={{
				__html: hintsUtils.getClientHintCheckScript(),
			}}
		/>
	);
}
