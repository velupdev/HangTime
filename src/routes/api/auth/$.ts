import { createFileRoute } from "@tanstack/react-router";
import { auth, SESSION_TOKEN_COOKIE } from "@/lib/auth/server";
import { withSignedInHint } from "@/lib/auth/signed-in-hint";

function handle(request: Request) {
  return auth.handler(request).then((response) =>
    withSignedInHint(response, SESSION_TOKEN_COOKIE),
  );
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
