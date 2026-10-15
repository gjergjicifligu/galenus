import assert from "node:assert/strict";
import { expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
export async function verifyMedia(page: Page, origin: string) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/en/manage`);
  await page
    .getByRole("button", { name: "Media library", exact: true })
    .click();
  await page.locator(".drop-zone").waitFor();
  await page
    .locator('input[type="file"]')
    .setInputFiles("tests/fixtures/clip.webm");
  await page.getByRole("button", { name: "Upload media", exact: true }).click();
  const webm = page
    .locator(".media-library-card")
    .filter({ hasText: "clip.webm" });
  await webm.waitFor();
  await expect
    .poll(() =>
      webm.locator("video").evaluate((v) => (v as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await webm.locator("video").evaluate(async (element) => {
    const video = element as HTMLVideoElement;
    video.muted = true;
    await video.play();
  });
  await expect
    .poll(() =>
      webm
        .locator("video")
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0);
  const transfer = await page.evaluateHandle(
    ({ bytes }) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([new Uint8Array(bytes)], "dropped-photo.png", {
          type: "image/png",
        }),
      );
      return transfer;
    },
    { bytes: Array.from(readFileSync("tests/fixtures/photo.png")) },
  );
  await page
    .locator(".drop-zone")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  await page.getByRole("button", { name: "Upload media", exact: true }).click();
  const photo = page
    .locator(".media-library-card")
    .filter({ hasText: "dropped-photo.png" });
  await photo.waitFor();
  await expect
    .poll(() =>
      photo
        .locator("img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a real image"),
  });
  await page.getByRole("button", { name: "Upload media", exact: true }).click();
  await expect(page.locator(".upload-form [role=status]")).toContainText(
    "damaged",
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await page.getByRole("button", { name: "Upload media", exact: true }).click();
  await expect(page.locator(".upload-form [role=status]")).toContainText(
    "Unsupported format",
  );
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/sq/modules`);
    assert.equal(
      await page.locator("header .logo img").getAttribute("src"),
      "/logo.svg",
    );
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect
      .poll(() =>
        page
          .locator(".header")
          .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
      )
      .toBe(0);
    assert.equal(
      await page.locator('footer a[href*="manage"],a[href*="privacy"]').count(),
      0,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    if (width === 390) {
      await page.getByRole("button", { name: "Hapni menynë" }).click();
      await expect(page.locator(".nav")).toBeVisible();
    }
    await page.screenshot({
      path: `test-results/modules-${width}.png`,
      fullPage: true,
    });
  }
  for (const [lang, first, last, email, button, success] of [
    [
      "en",
      "First name",
      "Last name",
      "Email address",
      "Register",
      "successfully",
    ],
    ["sq", "Emri", "Mbiemri", "Adresa e emailit", "Regjistrohuni", "sukses"],
  ]) {
    await page.goto(`${origin}/${lang}/modules`);
    assert.equal(await page.locator("main video").count(), 0);
    await page.getByLabel(first, { exact: true }).fill("Test");
    await page.getByLabel(last, { exact: true }).fill("Browser");
    await page
      .getByLabel(email, { exact: true })
      .fill(`${lang}-form@example.test`);
    await page.locator("#register input[type=checkbox]").check();
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.locator("#register .success")).toContainText(success);
    await page
      .context()
      .clearCookies({ name: "gma_module_module-placeholder" });
  }
}
