export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Only known workspace endpoints; never accept a browser-supplied destination.
const allowed =
  /^(?:chat|assistants\/[\w-]+\/chat|files(?:\/generate|\/[\w-]+\/(?:status|download|regenerate))?|conversations\/[\w-]+\/files|auth\/(?:google|refresh))$/;
const failure = (status: number, code: string, message: string) =>
  Response.json(
    { error: { code, message, retryable: status >= 500 } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );

type WorkspaceRouteContext = {
  params: { path?: string[] } | Promise<{ path?: string[] }>;
};

async function resolveRoute(context: WorkspaceRouteContext) {
  const params = await context.params;
  return Array.isArray(params.path) ? params.path.join("/") : "";
}

function googleFailureRedirect(request: Request, code = "server_config") {
  const redirect = new URL("/auth/login", request.url);
  redirect.searchParams.set("error", code);
  const state = new URL(request.url).searchParams.get("state");
  if (state?.startsWith("/") && !state.startsWith("//") && !state.includes("://")) {
    redirect.searchParams.set("returnTo", state);
  }
  return Response.redirect(redirect, 302);
}

async function relay(
  request: Request,
  context: WorkspaceRouteContext,
) {
  const route = await resolveRoute(context);
  if (!allowed.test(route))
    return failure(404, "ROUTE_NOT_FOUND", "Route not found.");
  if (!request.headers.get("authorization") && route !== "auth/refresh" && route !== "auth/google")
    return failure(401, "FILE_LOGIN_REQUIRED", "Sign in again to continue.");
  const configured =
    process.env.API_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured)
    return failure(
      503,
      "API_NOT_CONFIGURED",
      "The chat server is not configured. Ask the administrator to configure the API connection.",
    );
  let target: URL;
  try {
    const base = new URL(configured);
    if (
      !/^https?:$/.test(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      throw new Error("Invalid API destination");
    if (base.origin === new URL(request.url).origin)
      throw new Error("API relay loop");
    target = new URL(`${base.toString().replace(/\/$/, "")}/api/${route}`);
    const query = new URL(request.url).searchParams;
    for (const key of ["assistantId", "inline", "state"]) {
      const value = query.get(key);
      if (value !== null) target.searchParams.set(key, value);
    }
  } catch {
    return failure(
      503,
      "API_NOT_CONFIGURED",
      "The chat server address is invalid. Ask the administrator to check the API connection.",
    );
  }
  const headers = new Headers();
  for (const key of ["authorization", "content-type", "accept"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  const abortUpstream = () => controller.abort();
  if (request.signal.aborted) controller.abort();
  else request.signal.addEventListener("abort", abortUpstream, { once: true });
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      ...(request.method === "POST"
        ? { body: await request.arrayBuffer() }
        : {}),
    });
    if (upstream.status >= 300 && upstream.status < 400 && route === "auth/google") {
      const location = upstream.headers.get("location");
      if (location) {
        return new Response(null, {
          status: upstream.status,
          headers: {
            Location: location,
            "Cache-Control": "private, no-store",
          },
        });
      }
    }
    if (upstream.status >= 300 && upstream.status < 400)
      return failure(
        502,
        "API_REDIRECT",
        "The chat server redirected this request. Ask the administrator to check the API address.",
      );
    const outgoing = new Headers({
      "Cache-Control": "private, no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    });
    // Fetch may decompress the response, so do not forward content-length.
    for (const key of [
      "content-type",
      "content-disposition",
      "retry-after",
      "x-correlation-id",
    ]) {
      const value = upstream.headers.get(key);
      if (value) outgoing.set(key, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outgoing,
    });
  } catch {
    if (route === "auth/google") {
      return googleFailureRedirect(request, controller.signal.aborted ? "timeout" : "server_config");
    }
    return failure(
      controller.signal.aborted ? 504 : 502,
      "API_CONNECTION_FAILED",
      controller.signal.aborted
        ? "The chat server took too long to respond. Please retry."
        : "The chat server could not be reached. Please retry; if this continues, ask the administrator to check the API deployment.",
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortUpstream);
  }
}
async function safeRelay(request: Request, context: WorkspaceRouteContext) {
  try {
    return await relay(request, context);
  } catch (error) {
    console.error("[Workspace Relay Error]", error);
    const route = await resolveRoute(context).catch(() => "");
    if (route === "auth/google") return googleFailureRedirect(request);
    return failure(
      502,
      "API_CONNECTION_FAILED",
      "The chat server could not be reached. Please retry; if this continues, ask the administrator to check the API deployment.",
    );
  }
}

export const GET = safeRelay;
export const POST = safeRelay;
