import { expect, test } from "@playwright/test";

const PUBLIC_PAGES = [
  "/",
  "/ai-lead-finder",
  "/contact",
  "/terms",
  "/privacy",
  "/do-not-sell",
  "/signin",
  "/signup",
];

for (const path of PUBLIC_PAGES) {
  test(`${path} loads with no console errors and a real title`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);

    await expect(page).toHaveTitle(/.+/);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(10);

    expect(consoleErrors, `console errors on ${path}: ${consoleErrors.join("; ")}`).toEqual(
      [],
    );
  });
}

test("homepage pricing card says cancel anytime, no day-7 lock language", async ({
  page,
}) => {
  await page.goto("/");
  const pricingSection = page.locator("#pricing");
  await expect(pricingSection).toContainText(/cancel anytime/i);
  await expect(pricingSection).not.toContainText(/starting 7 days after/i);
  await expect(pricingSection).not.toContainText(/after day 7/i);
});

test("homepage FAQ refund answer says cancel anytime, no day-7 lock language", async ({
  page,
}) => {
  await page.goto("/");
  // FAQ answers are inside <details>/<summary> — force-open every one so
  // Playwright can read their text without a click-per-item loop.
  await page.evaluate(() => {
    document
      .querySelectorAll("details")
      .forEach((d) => d.setAttribute("open", ""));
  });
  const faqSection = page.locator("body");
  await expect(faqSection).toContainText(/you can cancel anytime/i);
});

test("no leftover pilot/beta language on the homepage", async ({ page }) => {
  await page.goto("/");
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/private pilot/i);
  expect(bodyText).not.toMatch(/early access/i);
});

test("nav links to the AI Lead Finder page and it loads", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: /AI Lead Finder/i }).first().click();
  await expect(page).toHaveURL(/\/ai-lead-finder/);
});

test("mobile viewport: homepage has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflow).toBe(false);
});
