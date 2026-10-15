import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

// Exercised against the isolated fixture server by integration.test.ts.
export async function verifyCms(
  origin: string,
  password: string,
  previewId: string,
  fullId: string,
  dataDir: string,
) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const panel = () => page.locator(".editor-panel");
  const bilingual = (language: number, label: string) =>
    panel()
      .locator(".bilingual-fields > fieldset")
      .nth(language)
      .getByLabel(label, { exact: true });
  const nav = (name: string) =>
    page
      .locator(".dashboard-sidebar")
      .getByRole("button", { name, exact: true })
      .click();
  async function save() {
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    assert.equal((await response).status(), 200);
    await panel().waitFor({ state: "detached" });
  }
  async function changeStatus(
    row: ReturnType<typeof page.getByRole>,
    label: string,
  ) {
    const response = page.waitForResponse(
      (r) => r.url().includes("/api/") && r.request().method() === "POST",
    );
    await row.getByRole("button", { name: label, exact: true }).click();
    assert.equal((await response).status(), 200);
    await row
      .getByRole("button", {
        name: label === "Publish" ? "Unpublish" : "Publish",
        exact: true,
      })
      .waitFor();
  }
  const publicText = async (lang: string, url: string) =>
    (await page.request.get(`${origin}/${lang}/${url}`)).text();
  try {
    await page.goto(`${origin}/en/manage`);
    await page
      .getByLabel("Email address", { exact: true })
      .fill("admin@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await nav("Media library");
    await page.getByLabel("Media library", { exact: true }).setInputFiles({
      name: "cms-photo.png",
      mimeType: "image/png",
      buffer: readFileSync("tests/fixtures/photo.png"),
    });
    const uploaded = page.waitForResponse(
      (r) => r.url().endsWith("/api/media") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Upload media", exact: true })
      .click();
    const imageId = (await (await uploaded).json()).id;
    assert.ok(imageId);
    const configurations = [
      {
        tab: "Meet our doctors.",
        kind: "doctors",
        key: "biography",
        label: "Biography",
        url: "about",
        row: "CMS doctor",
      },
      {
        tab: "Contact details",
        kind: "contacts",
        key: "address",
        label: "Address",
        url: "",
        row: "cms@example.test",
      },
      {
        tab: "Gallery",
        kind: "gallery",
        key: "description",
        label: "Description",
        url: "gallery",
        row: "CMS gallery",
      },
      {
        tab: "Modules",
        kind: "modules",
        key: "description",
        label: "Description",
        url: "modules",
        row: "CMS module",
      },
    ];
    for (const config of configurations) {
      await nav(config.tab);
      await page
        .getByRole("button", { name: "Add record", exact: true })
        .click();
      const values = ["SQ CMS " + config.kind, "EN CMS " + config.kind];
      await bilingual(0, config.label).fill(values[0]);
      await bilingual(1, config.label).fill(values[1]);
      if (config.kind === "doctors") {
        await panel().getByLabel("Name", { exact: true }).fill(config.row);
        await panel()
          .getByLabel("Image", { exact: true })
          .selectOption(imageId);
      }
      if (config.kind === "contacts") {
        await panel()
          .getByLabel("Contact email", { exact: true })
          .fill(config.row);
        await panel().getByLabel("Phone", { exact: true }).fill("+355 000 000");
        await bilingual(0, "Opening hours").fill("SQ hours");
        await bilingual(1, "Opening hours").fill("EN hours");
      }
      if (["gallery", "modules"].includes(config.kind)) {
        for (const language of [0, 1])
          await bilingual(language, "Title").fill(config.row);
        await panel().getByLabel("Date", { exact: true }).fill("2026-10-13");
        await panel()
          .getByLabel("Image", { exact: true })
          .selectOption(imageId);
      }
      if (config.kind === "gallery")
        await panel()
          .getByLabel("Media library", { exact: true })
          .selectOption(imageId);
      if (config.kind === "modules") {
        await panel()
          .getByLabel("Lecturer", { exact: true })
          .fill("CMS lecturer");
        await bilingual(0, "Lecturer details").fill("SQ lecturer details");
        await bilingual(1, "Lecturer details").fill("EN lecturer details");
        await panel()
          .getByLabel("Full video (private)", { exact: true })
          .selectOption(fullId);
      }
      await save();
      let row = page.getByRole("row").filter({ hasText: config.row });
      await row.getByRole("button", { name: "Publish", exact: true }).waitFor();
      for (const [i, lang] of ["sq", "en"].entries())
        assert.ok(
          !(await publicText(lang, config.url)).includes(values[i]),
          `${config.kind} draft leaked`,
        );
      await row.getByRole("button", { name: "View", exact: true }).click();
      assert.equal(await bilingual(1, config.label).inputValue(), values[1]);
      assert.ok(await bilingual(1, config.label).isDisabled());
      if (["doctors", "gallery", "modules"].includes(config.kind))
        assert.ok(
          await panel().locator(`img[src="/api/media/${imageId}"]`).count(),
        );
      await panel().getByRole("button", { name: "Close", exact: true }).click();
      await changeStatus(row, "Publish");
      const collection = await (
        await page.request.get(`${origin}/api/${config.kind}`)
      ).json();
      const saved = collection.find(
        (r: Record<string, unknown>) => r[`${config.key}_en`] === values[1],
      );
      assert.ok(saved);
      const publicUrl =
        config.kind === "modules" ? `modules/${saved.id}` : config.url;
      for (const [i, lang] of ["sq", "en"].entries())
        assert.ok(
          (await publicText(lang, publicUrl)).includes(values[i]),
          `${config.kind} did not publish ${lang}`,
        );
      if (config.kind === "contacts")
        for (const url of ["about", "gallery", "modules"])
          assert.ok((await publicText("en", url)).includes("cms@example.test"));
      if (config.kind === "modules") {
        const html = await publicText("en", publicUrl);
        assert.ok(html.includes("EN lecturer details"));
        assert.ok(html.includes(imageId));
        assert.ok(!html.includes("<form"));
        assert.ok(!html.includes(fullId));
      }
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      await bilingual(0, config.label).fill(values[0] + " updated");
      await bilingual(1, config.label).fill(values[1] + " updated");
      if (config.kind === "gallery")
        await panel()
          .getByLabel("Media library", { exact: true })
          .selectOption(previewId);
      await save();
      for (const [i, lang] of ["sq", "en"].entries())
        assert.ok(
          (await publicText(lang, publicUrl)).includes(values[i] + " updated"),
        );
      if (config.kind === "gallery")
        assert.ok((await publicText("en", "gallery")).includes(`<video`));
      await page.reload();
      await page
        .locator(".dashboard-sidebar")
        .getByRole("button", { name: config.tab, exact: true })
        .waitFor();
      await nav(config.tab);
      await row.getByRole("button", { name: "View", exact: true }).click();
      assert.equal(
        await bilingual(1, config.label).inputValue(),
        values[1] + " updated",
      );
      await panel().getByRole("button", { name: "Close", exact: true }).click();
      // A new independent connection proves persistence beyond React state and request memory.
      const persisted = new DatabaseSync(path.join(dataDir, "academy.sqlite"));
      const stored = JSON.parse(
        (
          persisted
            .prepare("SELECT data FROM records WHERE id=?")
            .get(saved.id) as { data: string }
        ).data,
      );
      persisted.close();
      assert.equal(stored[`${config.key}_en`], values[1] + " updated");
      await changeStatus(row, "Unpublish");
      for (const [i, lang] of ["sq", "en"].entries())
        assert.ok(!(await publicText(lang, publicUrl)).includes(values[i]));
      if (config.kind === "modules")
        assert.equal(
          (await page.request.get(`${origin}/api/watch/${saved.id}`)).status(),
          404,
        );
      await changeStatus(row, "Publish");
      const deleted = page.waitForResponse(
        (r) => r.request().method() === "DELETE",
      );
      await row.getByRole("button", { name: /^Delete:/ }).click();
      assert.equal((await deleted).status(), 200);
      await row.waitFor({ state: "detached" });
      assert.ok(!(await publicText("en", publicUrl)).includes(values[1]));
      const checkDeleted = new DatabaseSync(
        path.join(dataDir, "academy.sqlite"),
      );
      assert.equal(
        checkDeleted.prepare("SELECT id FROM records WHERE id=?").get(saved.id),
        undefined,
      );
      checkDeleted.close();
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({
      path: "test-results/cms-failure.png",
      fullPage: true,
    });
    throw error;
  } finally {
    await browser.close();
  }
}
