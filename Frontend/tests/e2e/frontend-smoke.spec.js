import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", heading: "Transform hospital operations with secure digital workflows" },
  { path: "/platform", heading: "Connected workflows for every clinical role" },
  { path: "/security", heading: "Protecting patient records at every touchpoint" },
  { path: "/compliance", heading: "Built for audit-ready healthcare operations" },
  { path: "/contact", heading: "Plan your secure healthcare digitization rollout" },
  { path: "/signup", heading: "Create Account" },
  { path: "/signin", heading: "Sign In" }
];

for (const route of routes) {
  test(`loads ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    await expect(page.getByRole("link", { name: "EHR Electronic Health Records" })).toBeVisible();
  });
}

test("protects portal route for signed-out users", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
});
