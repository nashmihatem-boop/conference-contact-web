import { expect, test, type Page } from "@playwright/test";

// Search-flow tests that mock the /anonymous POST also need the initial
// status GET mocked to "searches remaining" — otherwise the real, shared
// IP-scoped daily quota (which may genuinely be exhausted already) disables
// the input/button on load before the test ever gets to its own mock, per
// the exhaustion-disables-controls fix on ai-lead-finder.astro.
async function mockSearchesRemaining(page: Page): Promise<void> {
  await page.route("**/leads/ai-search/anonymous/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ maxSearchesPerDay: 3, searchesRemainingToday: 3 }),
    });
  });
}

test.describe("Anonymous AI Lead Finder", () => {
  test("shows the free-search count on load", async ({ page }) => {
    await page.goto("/ai-lead-finder");
    // Either a remaining count or "you've used them all" is a valid real
    // state — this quota is IP-scoped and shared with every other run
    // against this backend today, so it may already be exhausted.
    await expect(page.locator("#anon-search-status")).toContainText(
      /free search(es)? remaining today|used all your free searches today/i,
    );
  });

  test("example query chips are clickable and trigger a real search", async ({
    page,
  }) => {
    await page.goto("/ai-lead-finder");
    const status = page.locator("#anon-search-status");
    const before = await status.textContent();

    // Skip gracefully rather than fail — this test shares a real,
    // IP-scoped daily quota with every other run against this backend
    // today (manual testing, other suites, CI reruns). Exhaustion is
    // itself a real product state, covered separately below via a
    // mocked response instead of by burning the shared limit here.
    test.skip(
      /used all your free searches/i.test(before ?? ""),
      "anonymous daily quota already exhausted for this IP today",
    );

    const firstChip = page.locator("[data-example-query]").first();
    await firstChip.click();

    const submitBtn = page.locator("#anon-search-submit");
    await expect(submitBtn).toHaveText(/searching/i);
    await expect(submitBtn).toHaveText(/search/i, { timeout: 30_000 });

    // Either a real result card or a real "no matches" message — both are
    // the same success path, unlike the modal (failure path).
    await expect(page.locator("#anon-results")).toBeVisible();
    await expect(page.locator("#anon-limit-modal")).toBeHidden();
  });

  test("a query under 3 characters does not submit", async ({ page }) => {
    await mockSearchesRemaining(page);
    await page.goto("/ai-lead-finder");
    await page.locator("#anon-search-input").fill("ab");
    await page.locator("#anon-search-form").locator("button[type=submit]").click();
    // No request should have fired — status line still shows the initial count, not "Searching…".
    await expect(page.locator("#anon-search-submit")).not.toHaveText(/searching/i);
  });

  test("shows the exhaustion popup with the exact required copy once the daily limit is hit", async ({
    page,
  }) => {
    // Mocked at the network boundary — this is a rate-limit *exhaustion*
    // state, not a feature to exercise by actually making 3 real searches
    // per test run against a shared IP quota. Shape matches the real 403
    // LeadsService.checkAnonymousSearchLimit throws (ForbiddenException).
    await mockSearchesRemaining(page);
    await page.route("**/leads/ai-search/anonymous", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 403,
          message:
            "You've used all 3 free searches for today. Sign up for unlimited access.",
        }),
      });
    });

    await page.goto("/ai-lead-finder");
    await page.locator("#anon-search-input").fill("marketing directors in fintech");
    await page.locator("#anon-search-submit").click();

    const modal = page.locator("#anon-limit-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/free searches/i);
    await expect(page.locator("#anon-search-status")).toContainText(
      /used all your free searches today/i,
    );

    await page.locator("#anon-limit-close").click();
    await expect(modal).toBeHidden();
  });

  async function triggerExhaustionModal(page: Page): Promise<void> {
    await mockSearchesRemaining(page);
    await page.route("**/leads/ai-search/anonymous", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ statusCode: 403, message: "limit reached" }),
      });
    });
    await page.goto("/ai-lead-finder");
    await page.locator("#anon-search-input").fill("test query here");
    await page.locator("#anon-search-submit").click();
    await expect(page.locator("#anon-limit-modal")).toBeVisible();
  }

  test("Escape key dismisses the exhaustion modal", async ({ page }) => {
    await triggerExhaustionModal(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#anon-limit-modal")).toBeHidden();
  });

  test("clicking the backdrop dismisses the exhaustion modal", async ({
    page,
  }) => {
    await triggerExhaustionModal(page);
    const modal = page.locator("#anon-limit-modal");
    // Click the backdrop itself (top-left corner of the overlay, away from the dialog card).
    await modal.click({ position: { x: 5, y: 5 } });
    await expect(modal).toBeHidden();
  });
});
