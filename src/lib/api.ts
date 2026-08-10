import { getAccessToken } from "./session";

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
 * No `credentials: "include"` — nothing here relies on cookies. The API's
 * refresh-token cookie is SameSite=Strict and scoped to its own origin, so
 * it could never be sent back from this (different-origin) site anyway;
 * every call here authenticates purely via the Authorization header.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
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

/** Same as apiFetch, but attaches the stored access token — for routes that require sign-in. */
export async function authFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new ApiError("Not signed in", 401);
  }
  return apiFetch<T>(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
