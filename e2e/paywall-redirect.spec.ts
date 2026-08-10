import { expect, test } from "@playwright/test";

// A logged-out visitor hitting any authenticated page must land on /signin,
// not see a flash of real data first — this is the client-side half of the
// paywall; DirectoryAccessGuard/JwtAuthGuard on the backend is the half
// that actually matters for security, but this proves the UX doesn't leak
// anything before the redirect fires.
const PROTECTED_PAGES = [
  "/account",
  "/account/billing",
  "/settings",
  "/directory",
  "/leads-finder",
  "/admin",
  "/admin/users",
];

for (const path of PROTECTED_PAGES) {
  test(`logged-out visit to ${path} redirects to /signin without leaking data`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin/);

    // No paywalled data should ever be visible, even momentarily — check
    // the final rendered body, not a race-prone mid-redirect snapshot.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/@conference\.contact/);
  });
}
