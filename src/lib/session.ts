const ACCESS_TOKEN_KEY = "cc_access_token";

/**
 * sessionStorage, not localStorage — clears when the tab closes, which is
 * fine (arguably correct) here since there's no working silent-refresh
 * flow for this site to rely on anyway (see account.astro / signin.astro
 * comments on why: the API's refresh cookie is SameSite=Strict and this
 * site is a different origin, so it can never be sent back cross-site).
 * When the access token expires (15 min) or a call 401s, the user just
 * signs in again — that's the real, current behavior, not a bug to route
 * around client-side.
 */
export function saveAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/**
 * Sends a logged-out (or session-expired) visitor to sign in, carrying
 * where they were headed so signin.astro can send them back afterward
 * instead of always landing on the generic /account dashboard.
 */
export function redirectToSignin(): void {
  const path = window.location.pathname + window.location.search;
  window.location.href =
    path === "/" ? "/signin" : `/signin?redirect=${encodeURIComponent(path)}`;
}

/**
 * Only ever follow a same-site relative path from the `redirect` query
 * param — never an absolute/protocol-relative URL, which would make this
 * an open redirect (e.g. `?redirect=//evil.example`). Falls back to
 * /account, the previous unconditional destination.
 */
export function safeRedirectTarget(rawRedirect: string | null): string {
  if (!rawRedirect) return "/account";
  if (!rawRedirect.startsWith("/") || rawRedirect.startsWith("//")) {
    return "/account";
  }
  return rawRedirect;
}

function decodeAccessTokenPayload(): Record<string, unknown> | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

/**
 * Decodes the role claim out of the stored JWT for UI purposes only (e.g.
 * showing/hiding an "Admin" nav link) — this reads the payload without
 * verifying the signature, so it is never a security boundary. Real
 * authorization is enforced server-side by RolesGuard on every /admin/*
 * route regardless of what this returns.
 */
export function getTokenRole(): string | null {
  const payload = decodeAccessTokenPayload();
  return typeof payload?.role === "string" ? payload.role : null;
}

export function getTokenEmail(): string | null {
  const payload = decodeAccessTokenPayload();
  return typeof payload?.email === "string" ? payload.email : null;
}

/**
 * Present only when the stored token was minted by an admin's "View as
 * user" action (see admin/users.astro) — the admin's own user id. Drives
 * the impersonation banner in Nav.astro. Same non-security-boundary
 * caveat as getTokenRole: purely informational for the UI.
 */
export function getImpersonatorId(): string | null {
  const payload = decodeAccessTokenPayload();
  return typeof payload?.impersonatedBy === "string" ? payload.impersonatedBy : null;
}
