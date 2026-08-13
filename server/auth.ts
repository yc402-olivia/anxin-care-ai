import { jsonError } from "./http.ts";

type AuthenticatedUser = { id: string; email: string | null };

function supabaseConfig() {
  return {
    url: (process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  };
}

export async function authenticateRequest(
  request: Request,
): Promise<{ user: AuthenticatedUser; accessToken: string } | { response: Response }> {
  const { url, publishableKey } = supabaseConfig();
  if (!url || !publishableKey) {
    return { response: jsonError("SUPABASE_NOT_CONFIGURED", "Supabase authentication is not configured.", 503) };
  }

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) {
    return { response: jsonError("AUTH_REQUIRED", "Sign in before using AI document analysis.", 401) };
  }

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return { response: jsonError("AUTH_INVALID", "Your sign-in session has expired. Please sign in again.", 401) };
    }
    const user = (await response.json()) as { id?: unknown; email?: unknown };
    if (typeof user.id !== "string" || !user.id) {
      return { response: jsonError("AUTH_INVALID", "Supabase returned an invalid user session.", 401) };
    }
    return {
      user: { id: user.id, email: typeof user.email === "string" ? user.email : null },
      accessToken,
    };
  } catch {
    return { response: jsonError("AUTH_UNAVAILABLE", "Unable to verify your sign-in session.", 502) };
  }
}
