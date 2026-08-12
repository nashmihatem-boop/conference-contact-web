import { getAccessToken, saveAccessToken } from "./session";

const API_URL = import.meta.env.PUBLIC_API_URL;

/** Carries the real backend message so callers can show it directly instead of a generic fallback. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * `credentials: "include"` — the API's refresh-token cookie is scoped to
 * api.conference.contact, a same-site (though cross-subdomain) origin from
 * this site, so the browser will actually send/store it here. That's what
 * makes silent, cross-tab session restore in session.ts possible.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // AllExceptionsFilter's shape: { statusCode, error, message, path, timestamp, requestId }.
    // `message` is a string[] for class-validator errors, a plain string otherwise.
    const rawMessage = body?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(" ")
      : rawMessage || "Something went wrong. Please try again.";
    throw new ApiError(message, response.status);
  }

  return body as T;
}

/**
 * Same as apiFetch, but attaches the stored access token — for routes that
 * require sign-in. On a 401 (the access token expired mid-session — it only
 * lives 15 minutes), tries one silent refresh via the cookie and retries
 * once before giving up, so an active user isn't kicked out just because
 * 15 minutes passed.
 */
export async function authFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new ApiError("Not signed in", 401);
  }
  try {
    return await apiFetch<T>(path, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    if (!(err instanceof ApiError) || err.statusCode !== 401) throw err;
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw err;
    saveAccessToken(refreshed);
    return apiFetch<T>(path, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${refreshed}`,
      },
    });
  }
}

// A page like account.astro fires several authFetch calls in parallel
// (loadStatus(), loadInvites()) — if the stored access token is stale when
// they all run, every one of them independently lands here at once. The
// refresh token is single-use and rotates server-side on each call, so
// without this, only the first of those concurrent requests would get a
// token back; the rest would each present the same now-rotated-away token
// and fail. Sharing one in-flight promise means concurrent callers within
// this tab await the same network call and all receive the same result,
// instead of racing each other against a one-time-use token.
let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a fresh access token — no
 * credentials needed client-side, the browser just has to have the cookie.
 * Returns null on any failure (expired/missing cookie, network error, etc.)
 * rather than throwing, since every caller treats "couldn't refresh" as
 * "just isn't signed in," not an error to surface.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    try {
      const result = await apiFetch<{ accessToken: string | null }>(
        "/auth/refresh",
        { method: "POST" },
      );
      return result.accessToken ?? null;
    } catch {
      return null;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}
