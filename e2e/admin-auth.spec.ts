import { test, expect } from "@playwright/test";

// These only exercise the auth *boundary* (proxy.ts redirect + rejected
// credentials) — never a real login, since that needs a real admin account
// this test suite doesn't have (and shouldn't fabricate) credentials for.

test.describe("admin auth boundary", () => {
  test("visiting a protected admin page without a session redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("the login redirect preserves where the admin was headed", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders/);
  });

  test("submitting bad credentials shows an error and stays on the login page", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("not-a-real-admin@example.com");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: /log in|sign in/i }).click();

    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
