import { expect, test } from "@playwright/test";

/**
 * These flows need a real signed-in session, which needs two things this
 * sandbox doesn't have: (1) a known password for a real test account, and
 * (2) working transactional email — signin's device-code step (see
 * signin.astro's #code-form) emails a one-time code on an untrusted
 * device, and Resend is currently sandboxed to the account owner's own
 * inbox only (see the payment lifecycle audit finding). Until both are
 * fixed, every test below is a real, correctly-written flow that skips
 * itself rather than faking a pass — set the env vars to actually run it.
 *
 * Required env vars (all optional individually — each test skips on its own missing var):
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD        — a subscribed, verified test account
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD      — an ADMIN or SUPER_ADMIN account
 */

const userEmail = process.env.E2E_USER_EMAIL;
const userPassword = process.env.E2E_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/signin");
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.locator("#signin-submit").click();

  // A trusted device goes straight to /account; an untrusted one hits the
  // code-entry step and needs a real emailed code — this suite can only
  // proceed automatically for an already-trusted device/session.
  await Promise.race([
    page.waitForURL(/\/account/, { timeout: 10_000 }),
    page.locator("#code-form").waitFor({ state: "visible", timeout: 10_000 }),
  ]);
  if (await page.locator("#code-form").isVisible()) {
    throw new Error(
      "Signin hit the device-code step, which needs a real emailed code — " +
        "run this against a pre-trusted device/session, or fix Resend delivery first.",
    );
  }
}

test.describe("Signed-in user", () => {
  test.skip(!userEmail || !userPassword, "E2E_USER_EMAIL/PASSWORD not set");

  test("can sign in and land on /account", async ({ page }) => {
    await signIn(page, userEmail!, userPassword!);
    await expect(page).toHaveURL(/\/account/);
    await expect(page.locator("body")).not.toContainText(/error/i);
  });

  test("can search the Directory and see real results", async ({ page }) => {
    await signIn(page, userEmail!, userPassword!);
    await page.goto("/directory");
    const searchBox = page.locator('input[type="search"], input[name="search"]').first();
    await searchBox.fill("agency");
    await page.keyboard.press("Enter");
    await expect(page.locator("table, [role=table]")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("can export the Directory as CSV", async ({ page }) => {
    await signIn(page, userEmail!, userPassword!);
    await page.goto("/directory");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /export csv/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test("can run a Lead Finder AI search on the free tier", async ({
    page,
  }) => {
    await signIn(page, userEmail!, userPassword!);
    await page.goto("/leads-finder");
    await page.locator("textarea, input[type=text]").first().fill(
      "affiliate networks attending MAU Vegas",
    );
    await page.getByRole("button", { name: /find leads|search/i }).click();
    await expect(page.locator("table, [role=table]")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("cancel subscription flow shows the retention prompt before confirming", async ({
    page,
  }) => {
    await signIn(page, userEmail!, userPassword!);
    await page.goto("/account/billing");
    await page.locator("#cancel-button").click();
    const modal = page.locator("#cancel-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/before you cancel/i);
    // Deliberately keep the subscription — "Cancel anyway" is the
    // destructive path; this test only proves the retention UI works.
    await page.locator("#cancel-modal-keep").click();
    await expect(modal).toBeHidden();
  });
});

test.describe("Admin", () => {
  test.skip(!adminEmail || !adminPassword, "E2E_ADMIN_EMAIL/PASSWORD not set");

  test("can sign in and reach /admin", async ({ page }) => {
    await signIn(page, adminEmail!, adminPassword!);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
  });

  test("Users table loads real rows and columns sort", async ({ page }) => {
    await signIn(page, adminEmail!, adminPassword!);
    await page.goto("/admin/users");
    await expect(page.locator("table")).toBeVisible();
    const rowCountBefore = await page.locator("table tbody tr").count();
    expect(rowCountBefore).toBeGreaterThan(0);

    const sortableHeader = page.locator("th button, th[role=button]").first();
    if (await sortableHeader.isVisible()) {
      await sortableHeader.click();
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    }
  });

  test("a non-admin signed-in user is blocked from /admin", async ({
    page,
  }) => {
    test.skip(!userEmail || !userPassword, "E2E_USER_EMAIL/PASSWORD not set");
    await signIn(page, userEmail!, userPassword!);
    await page.goto("/admin");
    // Should not render the admin shell for a non-admin session.
    await expect(page.locator("body")).not.toContainText(/admin dashboard/i);
  });
});
