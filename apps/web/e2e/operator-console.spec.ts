import { test, expect } from "@playwright/test";

test.describe("operator console", () => {
  test("redirects unauthenticated visitors to the auth page", async ({ page, baseURL }) => {
    test.skip(!baseURL, "Set PAPERAI_WEB_BASE_URL to run Playwright E2E.");

    await page.goto("/app/overview");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Run a zero-human company with one shared control plane.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("opens the command palette for an authenticated operator", async ({ page, baseURL }) => {
    test.skip(
      !baseURL || !process.env.PAPERAI_E2E_EMAIL || !process.env.PAPERAI_E2E_PASSWORD,
      "Set PAPERAI_WEB_BASE_URL, PAPERAI_E2E_EMAIL, and PAPERAI_E2E_PASSWORD to run authenticated E2E.",
    );

    await page.goto("/");
    await page.getByLabel("Email").fill(process.env.PAPERAI_E2E_EMAIL!);
    await page.getByLabel("Password").fill(process.env.PAPERAI_E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/app/);
    await page.getByRole("button", { name: /Command palette/i }).click();
    await expect(page.getByText("Jump to an operator section")).toBeVisible();
  });
});
