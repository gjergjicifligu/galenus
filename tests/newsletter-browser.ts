import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
export async function verifyNewsletterBrowser(
  origin: string,
  password: string,
  image: string,
) {
  const browser = await chromium.launch({ headless: true }),
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const lang of ["sq", "en"]) {
      for (const route of ["", "/modules"]) {
        await page.goto(`${origin}/${lang}${route}`);
        const form = page.locator("#register");
        await form.locator('[name="firstName"]').fill("Browser");
        await form.locator('[name="lastName"]').fill(lang);
        await form
          .locator('[name="email"]')
          .fill(`${lang}-${route ? "modules" : "home"}@example.test`);
        await form.locator('[name="consent"]').check();
        await form.getByRole("button").click();
        await expect(form.locator(".success")).toBeVisible();
      }
      await page.goto(`${origin}/${lang}/modules/newsletter-module`);
      assert.equal(await page.locator("main form").count(), 0);
      await expect(page.locator(".access-card a")).toHaveAttribute(
        "href",
        `/${lang}/modules#register`,
      );
    }
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${origin}/en`);
      if (width < 900)
        await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .locator(width < 1000 ? ".mobile-register" : ".header-register")
        .click();
      await page.waitForURL("**/en/modules#register");
      await expect(
        page.locator("#register input[name=firstName]"),
      ).toBeInViewport();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/en/manage`);
    await page
      .getByLabel("Email address", { exact: true })
      .fill("editor@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Modules", exact: true }),
    ).toBeVisible();
    assert.equal(
      await page
        .getByRole("button", {
          name: "Newsletter / Email campaigns",
          exact: true,
        })
        .count(),
      0,
    );
    await page.getByRole("button", { name: "Add record", exact: true }).click();
    const panel = page.locator(".editor-panel");
    for (const language of [0, 1]) {
      const fields = panel
        .locator(".bilingual-fields > fieldset")
        .nth(language);
      await fields
        .getByLabel("Title", { exact: true })
        .fill("Browser resource module");
      await fields
        .getByLabel("Description", { exact: true })
        .fill("Resource description.\n\nSecond paragraph.");
    }
    await panel.getByLabel("Image", { exact: true }).selectOption(image);
    const doc = await PDFDocument.create();
    doc.addPage().drawText("Browser PDF resource", { x: 40, y: 700, size: 24 });
    const resources = panel.locator(".resource-editor");
    await resources
      .locator('input[type="file"]')
      .setInputFiles(["tests/fixtures/photo.png", "tests/fixtures/clip.mp4"]);
    await expect(resources.getByRole("status")).toHaveText("Changes saved.");
    await resources.locator('input[type="file"]').setInputFiles({
      name: "browser.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await doc.save()),
    });
    await expect(resources.getByRole("status")).toHaveText("Changes saved.");
    for (const [i, name] of [
      "photo.png",
      "clip.mp4",
      "browser.pdf",
    ].entries()) {
      await resources
        .getByRole("button", { name: "Add resource", exact: true })
        .click();
      const row = resources.locator(".resource-item").nth(i);
      await row
        .getByLabel("Select media", { exact: true })
        .selectOption({ label: name });
      await row
        .locator(".bilingual-fields > fieldset")
        .nth(0)
        .getByLabel("Title", { exact: true })
        .fill(`Material ${i}`);
      await row
        .locator(".bilingual-fields > fieldset")
        .nth(1)
        .getByLabel("Title", { exact: true })
        .fill(`Resource ${i}`);
      await row.getByLabel("Order", { exact: true }).fill(String(2 - i));
      await row.getByLabel("Published", { exact: true }).check();
    }
    await expect(resources.locator("img")).toBeVisible();
    await expect(resources.locator("video")).toBeVisible();
    await expect(resources.locator("canvas")).toBeVisible();
    await expect(resources.locator(".pdf-preview")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    assert.ok(
      await resources.locator("canvas").evaluate((el) => {
        const canvas = el as HTMLCanvasElement;
        const data = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let dark = 0;
        for (let i = 0; i < data.length; i += 4)
          if (
            data[i] < 100 &&
            data[i + 1] < 100 &&
            data[i + 2] < 100 &&
            data[i + 3] > 0
          )
            dark++;
        return dark > 20;
      }),
    );
    await resources.screenshot({
      path: "test-results/module-resource-previews.png",
    });
    await panel.getByLabel("Published", { exact: true }).last().check();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await panel.waitFor({ state: "detached" });
    await expect(
      page.getByRole("row").filter({ hasText: "Browser resource module" }),
    ).toBeVisible();
    const savedModules = await (
      await page.request.get(`${origin}/api/modules`)
    ).json();
    const savedModule = savedModules.find(
      (r: { title_en: string }) => r.title_en === "Browser resource module",
    );
    await page.goto(`${origin}/en/modules/${savedModule.id}`);
    assert.deepEqual(
      await page.locator(".resource-public h3").allTextContents(),
      ["Resource 2", "Resource 1", "Resource 0"],
    );
    await page.goto(`${origin}/en/manage`);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page
      .getByLabel("Email address", { exact: true })
      .fill("admin@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Newsletter / Email campaigns",
        exact: true,
      })
      .click();
    const campaign = page.locator(".campaign-dashboard");
    await campaign
      .getByLabel("Campaign name", { exact: true })
      .fill("Browser campaign");
    await campaign
      .locator(".bilingual-fields > fieldset")
      .nth(0)
      .getByLabel("Subject", { exact: true })
      .fill("Modulet për ju");
    await campaign
      .locator(".bilingual-fields > fieldset")
      .nth(1)
      .getByLabel("Subject", { exact: true })
      .fill("Modules for you");
    const moduleSelection = campaign.locator(".campaign-module-selection"),
      subscriberSelection = campaign.locator(".campaign-subscriber-selection");
    await moduleSelection
      .getByLabel("Search", { exact: true })
      .fill("Newsletter module");
    await moduleSelection
      .getByRole("button", {
        name: "Select all in the filtered list",
        exact: true,
      })
      .click();
    assert.equal(
      await moduleSelection.locator('input[type="checkbox"]:checked').count(),
      1,
    );
    await moduleSelection.getByLabel("Search", { exact: true }).fill("");
    await moduleSelection
      .getByRole("button", {
        name: "Select all in the filtered list",
        exact: true,
      })
      .click();
    assert.equal(
      await moduleSelection.locator('input[type="checkbox"]:checked').count(),
      await moduleSelection.locator('input[type="checkbox"]').count(),
    );
    await moduleSelection
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    await moduleSelection.getByRole("checkbox").first().check();
    await subscriberSelection
      .getByLabel("Search", { exact: true })
      .fill("en-home@example.test");
    await subscriberSelection
      .getByRole("button", {
        name: "Select all in the filtered list",
        exact: true,
      })
      .click();
    assert.equal(
      await subscriberSelection
        .locator('input[type="checkbox"]:checked')
        .count(),
      1,
    );
    await subscriberSelection.getByRole("checkbox").first().uncheck();
    await subscriberSelection.getByRole("checkbox").first().check();
    await subscriberSelection.getByLabel("Search", { exact: true }).fill("");
    await subscriberSelection
      .getByRole("button", {
        name: "Select all in the filtered list",
        exact: true,
      })
      .click();
    assert.equal(
      await subscriberSelection
        .locator('input[type="checkbox"]:checked')
        .count(),
      await subscriberSelection.locator('input[type="checkbox"]').count(),
    );
    assert.equal(
      await subscriberSelection
        .getByText("grace@example.test", { exact: false })
        .count(),
      0,
    );
    await subscriberSelection
      .getByRole("button", { name: "Clear selection", exact: true })
      .click();
    await subscriberSelection
      .getByRole("checkbox")
      .filter({ hasText: "" })
      .first()
      .check();
    await campaign
      .getByRole("button", { name: "Save campaign", exact: true })
      .click();
    await expect(campaign.locator(".campaign-preview iframe")).toBeVisible();
    await campaign
      .locator(".campaign-preview")
      .getByLabel("Language", { exact: true })
      .selectOption("en");
    await expect(
      campaign
        .frameLocator(".campaign-preview iframe")
        .getByRole("heading", { name: "Modules for you", exact: true }),
    ).toBeVisible();
    await campaign
      .getByLabel("Test email address", { exact: true })
      .fill("browser-test@example.test");
    await campaign
      .getByRole("button", { name: "Send test email", exact: true })
      .click();
    await expect(campaign.getByRole("status")).toContainText(
      "accepted by the SMTP",
    );
    await expect(
      campaign.getByRole("button", { name: "Send campaign", exact: true }),
    ).toBeDisabled();
    await campaign
      .getByLabel(
        "I confirm sending to the selected subscribers after reviewing both languages.",
        { exact: true },
      )
      .check();
    await campaign
      .getByRole("button", { name: "Send campaign", exact: true })
      .click();
    await expect(
      campaign.locator(".campaign-preview table").first(),
    ).toContainText("Accepted by SMTP");
    await expect(
      campaign.getByRole("button", { name: "Send campaign", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: "test-results/newsletter-campaign.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({
      path: "test-results/newsletter-failure.png",
      fullPage: true,
    });
    throw error;
  } finally {
    await browser.close();
  }
}
