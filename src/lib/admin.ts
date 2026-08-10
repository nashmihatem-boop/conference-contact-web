import { ApiError } from "./api";
import { clearAccessToken, ensureAuthenticated, redirectToSignin } from "./session";

/** Shared by every /admin/* page — 401 means not signed in at all, 403 means signed in but not an admin. */
export function handleAdminError(err: unknown, errorEl: HTMLElement): void {
  if (err instanceof ApiError && err.statusCode === 401) {
    clearAccessToken();
    redirectToSignin();
    return;
  }
  if (err instanceof ApiError && err.statusCode === 403) {
    window.location.href = "/account";
    return;
  }
  errorEl.textContent =
    err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
  errorEl.hidden = false;
}

export async function requireSignedIn(): Promise<boolean> {
  if (!(await ensureAuthenticated())) {
    redirectToSignin();
    return false;
  }
  return true;
}

export function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
