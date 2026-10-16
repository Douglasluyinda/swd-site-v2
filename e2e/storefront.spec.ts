import { test, expect } from "@playwright/test";

test.describe("storefront navigation", () => {
  test("homepage loads with the SWD brand and primary nav", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SWD/i);
    await expect(page.locator("nav")).toBeVisible();
  });

  test("products page lists the catalogue and supports search", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: /SWD Access catalogue/i })).toBeVisible();

    const search = page.getByPlaceholder("Search products…");
    await expect(search).toBeVisible();
    await search.fill("zzzzz-no-such-product-zzzzz");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=zzzzz-no-such-product-zzzzz/);
  });

  test("cart page renders without being signed in or having items", async ({ page }) => {
    await page.goto("/cart");
    // Whatever the empty-cart copy is, the page should render (not 500) and
    // stay on /cart rather than redirecting.
    await expect(page).toHaveURL(/\/cart$/);
  });
});
