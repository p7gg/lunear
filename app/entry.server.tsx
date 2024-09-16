import { PassThrough } from "node:stream";

import { randomBytes } from "node:crypto";
import type { AppLoadContext, EntryContext } from "@remix-run/node";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { NonceProvider } from "~/components/nonce-provider";

const ABORT_DELAY = 5_000;

export default function handleRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	_loadContext: AppLoadContext,
) {
	const cspNonce = randomBytes(16).toString("hex");

	responseHeaders.set(
		"Content-Security-Policy",
		`script-src 'nonce-${cspNonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none';`,
	);

	return isbot(request.headers.get("user-agent") || "")
		? handleBotRequest(
				request,
				responseStatusCode,
				responseHeaders,
				remixContext,
				cspNonce,
			)
		: handleBrowserRequest(
				request,
				responseStatusCode,
				responseHeaders,
				remixContext,
				cspNonce,
			);
}

function handleBotRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	nonce: string,
) {
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		const { pipe, abort } = renderToPipeableStream(
			<NonceProvider value={nonce}>
				<RemixServer
					context={remixContext}
					url={request.url}
					abortDelay={ABORT_DELAY}
					nonce={nonce}
				/>
			</NonceProvider>,
			{
				nonce,
				onAllReady() {
					shellRendered = true;
					const body = new PassThrough();
					const stream = createReadableStreamFromReadable(body);

					responseHeaders.set("Content-Type", "text/html");

					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);

					pipe(body);
				},
				onShellError(error: unknown) {
					reject(error);
				},
				onError(error: unknown) {
					// biome-ignore lint/style/noParameterAssign: <explanation>
					responseStatusCode = 500;
					// Log streaming rendering errors from inside the shell.  Don't log
					// errors encountered during initial shell rendering since they'll
					// reject and get logged in handleDocumentRequest.
					if (shellRendered) {
						console.error(error);
					}
				},
			},
		);

		setTimeout(abort, ABORT_DELAY);
	});
}

function handleBrowserRequest(
	request: Request,
	responseStatusCode: number,
	responseHeaders: Headers,
	remixContext: EntryContext,
	nonce: string,
) {
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		const { pipe, abort } = renderToPipeableStream(
			<NonceProvider value={nonce}>
				<RemixServer
					context={remixContext}
					url={request.url}
					abortDelay={ABORT_DELAY}
					nonce={nonce}
				/>
			</NonceProvider>,
			{
				nonce,
				onShellReady() {
					shellRendered = true;
					const body = new PassThrough();
					const stream = createReadableStreamFromReadable(body);

					responseHeaders.set("Content-Type", "text/html");

					resolve(
						new Response(stream, {
							headers: responseHeaders,
							status: responseStatusCode,
						}),
					);

					pipe(body);
				},
				onShellError(error: unknown) {
					reject(error);
				},
				onError(error: unknown) {
					// biome-ignore lint/style/noParameterAssign: <explanation>
					responseStatusCode = 500;
					// Log streaming rendering errors from inside the shell.  Don't log
					// errors encountered during initial shell rendering since they'll
					// reject and get logged in handleDocumentRequest.
					if (shellRendered) {
						console.error(error);
					}
				},
			},
		);

		setTimeout(abort, ABORT_DELAY);
	});
}
