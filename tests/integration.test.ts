import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
const testDirectory = mkdtempSync(path.join(tmpdir(), "galenus-test-"));
process.env.DATA_DIR = testDirectory;
process.env.SUBSCRIPTION_KEY = randomBytes(32).toString("hex");
const origin = "http://localhost:3217";
test("Academy end-to-end server authorization and content flows", async (t) => {
  const { db, record, saveRecord } = await import("../lib/db");
  const {
    passwordHash,
    verifyPassword,
    decryptEmail,
    encryptEmail,
    emailHash,
    hash,
    newToken,
  } = await import("../lib/security");
  const password = randomBytes(24).toString("base64url");
  const database = db();
  const adminId = randomUUID(),
    userId = randomUUID();
  database
    .prepare("INSERT INTO users VALUES (?,?,?,?,?)")
    .run(
      adminId,
      "admin@example.test",
      "Test administrator",
      passwordHash(password),
      "admin",
    );
  database
    .prepare("INSERT INTO users VALUES (?,?,?,?,?)")
    .run(
      userId,
      "editor@example.test",
      "Test editor",
      passwordHash(password),
      "user",
    );
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", "3217"],
    {
      env: { ...process.env, APP_ORIGIN: origin, COOKIE_SECURE: "false" },
      stdio: "pipe",
    },
  );
  let logs = "";
  server.stdout.on("data", (b) => (logs += b));
  server.stderr.on("data", (b) => (logs += b));
  async function request(
    endpoint: string,
    method = "GET",
    body?: unknown,
    cookie?: string,
  ) {
    return fetch(`${origin}/api/${endpoint}`, {
      method,
      headers: {
        Origin: origin,
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
  }
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(`${origin}/en`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, logs);
    let admin = "",
      editor = "",
      fullId = "",
      previewId = "",
      imageId = "",
      moduleId = "test-module",
      grant = "";
    await t.test("passwords are salted and verified", () => {
      const encoded = passwordHash(password);
      assert.ok(verifyPassword(password, encoded));
      assert.equal(verifyPassword("incorrect", encoded), false);
      assert.notEqual(encoded, passwordHash(password));
    });
    await t.test(
      "public pages render both languages with correct document language",
      async () => {
        for (const lang of ["sq", "en"])
          for (const route of [
            "",
            "/about",
            "/gallery",
            "/modules",
            "/modules/module-placeholder",
            "/manage",
          ]) {
            const res = await fetch(`${origin}/${lang}${route}`);
            assert.equal(res.status, 200, `${lang}${route}`);
            const html = await res.text();
            assert.ok(html.includes(`lang="${lang}"`));
            assert.ok(!html.includes("SUBSCRIPTION_KEY"));
          }
        assert.equal((await fetch(`${origin}/en/missing`)).status, 404);
      },
    );
    await t.test(
      "anonymous visitors cannot read management APIs or mutate content",
      async () => {
        for (const resource of [
          "users",
          "settings",
          "pages",
          "doctors",
          "gallery",
          "modules",
          "subscriptions",
          "media",
        ])
          assert.equal((await request(resource)).status, 401, resource);
        assert.equal(
          (await request("modules", "POST", { id: "bad" })).status,
          401,
        );
      },
    );
    await t.test(
      "login creates HttpOnly session cookies and rejects bad credentials / cross-origin posts",
      async () => {
        assert.equal(
          (
            await request("auth", "POST", {
              email: "admin@example.test",
              password: "incorrect",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await fetch(`${origin}/api/auth`, {
              method: "POST",
              headers: {
                Origin: "https://other.example",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: "admin@example.test", password }),
            })
          ).status,
          403,
        );
        for (const [email, set] of [
          ["admin@example.test", (x: string) => (admin = x)],
          ["editor@example.test", (x: string) => (editor = x)],
        ] as const) {
          const res = await request("auth", "POST", { email, password });
          assert.equal(res.status, 200);
          const cookie = res.headers.get("set-cookie")!;
          assert.match(cookie, /HttpOnly/i);
          assert.match(cookie, /SameSite=strict/i);
          set(cookie.split(";")[0]);
        }
      },
    );
    await t.test(
      "regular users are restricted on backend, including forged record IDs",
      async () => {
        for (const resource of [
          "users",
          "settings",
          "pages",
          "doctors",
          "subscriptions",
        ]) {
          assert.equal(
            (await request(resource, "GET", undefined, editor)).status,
            403,
          );
          assert.equal(
            (await request(resource, "POST", {}, editor)).status,
            403,
          );
          assert.equal(
            (await request(`${resource}/x`, "DELETE", undefined, editor))
              .status,
            403,
          );
        }
        assert.equal(
          (
            await request(
              "gallery",
              "POST",
              { id: "settings", kind: "gallery" },
              editor,
            )
          ).status,
          400,
        );
        assert.equal(
          (await request("users", "GET", undefined, admin)).status,
          200,
        );
      },
    );
    await t.test(
      "staff can upload public previews and private full videos; anonymous direct access is denied",
      async () => {
        for (const privateMedia of [false, true]) {
          const form = new FormData();
          form.set(
            "file",
            new File([readFileSync("tests/fixtures/clip.mp4")], "test.mp4", {
              type: "video/mp4",
            }),
          );
          form.set("private", String(privateMedia));
          const res = await request("media", "POST", form, editor);
          assert.equal(res.status, 201);
          const { id } = await res.json();
          if (privateMedia) fullId = id;
          else previewId = id;
        }
        assert.equal((await request(`media/${fullId}`)).status, 403);
        assert.equal((await request(`media/${previewId}`)).status, 200);
        const picture = new FormData();
        picture.set(
          "file",
          new File([readFileSync("tests/fixtures/photo.png")], "photo.png", {
            type: "image/png",
          }),
        );
        const pictureResult = await request("media", "POST", picture, editor);
        assert.equal(pictureResult.status, 201);
        imageId = (await pictureResult.json()).id;
        const invalid = new FormData();
        invalid.set("file", new File(["<script>bad</script>"], "bad.svg"));
        assert.equal(
          (await request("media", "POST", invalid, editor)).status,
          400,
        );
      },
    );
    await t.test(
      "module persistence validates private media and does not expose its ID to visitors",
      async () => {
        const input = {
          id: moduleId,
          kind: "modules",
          title_en: "Test module",
          title_sq: "Module testues",
          description_en: "Test only",
          description_sq: "Vetëm për testim",
          lecturer: "Test lecturer",
          published: true,
          thumbnail: imageId,
          fullMedia: fullId,
        };
        assert.equal(
          (
            await request(
              "modules",
              "POST",
              { ...input, fullMedia: previewId },
              editor,
            )
          ).status,
          400,
        );
        assert.equal(
          (await request("modules", "POST", input, editor)).status,
          200,
        );
        const html = await (
          await fetch(`${origin}/en/modules/${moduleId}`)
        ).text();
        assert.ok(!html.includes(fullId));
        assert.ok(html.includes(imageId));
        assert.ok(!html.includes("<video"));
        assert.equal((await request(`watch/${moduleId}`)).status, 403);
      },
    );
    await t.test(
      "all supported formats upload; loopback aliases work; malformed media and external origins stay rejected",
      async () => {
        const sharp = (await import("sharp")).default;
        for (const format of ["jpeg", "webp"] as const) {
          const bytes = await sharp("tests/fixtures/photo.png")
            .toFormat(format)
            .toBuffer();
          const form = new FormData();
          form.set("file", new File([new Uint8Array(bytes)], `test.${format}`));
          const response = await fetch(`${origin}/api/media`, {
            method: "POST",
            headers: { Origin: "http://127.0.0.1:3217", Cookie: editor },
            body: form,
          });
          assert.equal(response.status, 201);
        }
        const padding = Buffer.alloc(8);
        padding.writeUInt32BE(8);
        padding.write("free", 4);
        const form = new FormData();
        form.set(
          "file",
          new File(
            [padding, readFileSync("tests/fixtures/clip.mp4")],
            "padded.mp4",
          ),
        );
        assert.equal(
          (await request("media", "POST", form, editor)).status,
          201,
        );
        for (const [name, bytes] of [
          [
            "broken.png",
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
          ],
          ["broken.mp4", Buffer.from("0000ftypisom000000000")],
        ] as const) {
          const bad = new FormData();
          bad.set("file", new File([bytes], name));
          const res = await request("media", "POST", bad, editor);
          assert.equal(res.status, 400);
          assert.equal((await res.json()).error, "invalidMedia");
        }
        const foreign = new FormData();
        foreign.set(
          "file",
          new File([readFileSync("tests/fixtures/photo.png")], "foreign.png"),
        );
        assert.equal(
          (
            await fetch(`${origin}/api/media`, {
              method: "POST",
              headers: { Origin: "http://localhost:9999", Cookie: editor },
              body: foreign,
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "historical module enrollment grants remain valid; the old signup endpoint is closed",
      async () => {
        assert.equal(
          (
            await request(`subscribe/${moduleId}`, "POST", {
              email: "person@example.test",
              firstName: "Ada",
              lastName: "Test",
            })
          ).status,
          410,
        );
        const token = newToken();
        database
          .prepare("INSERT INTO grants VALUES (?,?,?)")
          .run(hash(token), moduleId, Date.now() + 86400000);
        grant = `gma_module_${moduleId}=${token}`;
        database
          .prepare("INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?)")
          .run(
            randomUUID(),
            moduleId,
            encryptEmail("person@example.test"),
            emailHash("person@example.test"),
            new Date().toISOString(),
            encryptEmail("Ada"),
            encryptEmail("Test"),
          );
        assert.equal((await fetch(`${origin}/en/privacy`)).status, 404);
      },
    );
    await t.test(
      "grants unlock only the subscribed module and support video range requests",
      async () => {
        const res = await fetch(`${origin}/api/watch/${moduleId}`, {
          headers: { Cookie: grant, Range: "bytes=0-9" },
        });
        assert.equal(res.status, 206);
        assert.equal((await res.arrayBuffer()).byteLength, 10);
        assert.equal(
          (await request(`media/${fullId}`, "GET", undefined, grant)).status,
          403,
        );
        saveRecord({ ...record(moduleId)!, id: "another-module" });
        assert.equal(
          (await request("watch/another-module", "GET", undefined, grant))
            .status,
          403,
        );
        const invalid = await fetch(`${origin}/api/watch/${moduleId}`, {
          headers: { Cookie: grant, Range: "bytes=10000-" },
        });
        assert.equal(invalid.status, 416);
      },
    );
    await t.test(
      "subscription emails are encrypted and admin can view/delete them",
      async () => {
        const stored = database
          .prepare("SELECT * FROM subscriptions")
          .get() as {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
        };
        assert.ok(!stored.email.includes("person@example.test"));
        assert.equal(decryptEmail(stored.email), "person@example.test");
        assert.equal(decryptEmail(stored.first_name), "Ada");
        assert.equal(decryptEmail(stored.last_name), "Test");
        const res = await request("subscriptions", "GET", undefined, admin);
        assert.equal(
          (await res.json()).find((r: { id: string }) => r.id === stored.id)
            .email,
          "person@example.test",
        );
        assert.equal(
          (
            await request(
              `subscriptions/${stored.id}`,
              "DELETE",
              undefined,
              admin,
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "admin can manage users but cannot demote or delete their own account",
      async () => {
        assert.equal(
          (
            await request(
              "users",
              "POST",
              {
                id: adminId,
                email: "admin@example.test",
                name: "Admin",
                role: "user",
              },
              admin,
            )
          ).status,
          400,
        );
        assert.equal(
          (await request(`users/${adminId}`, "DELETE", undefined, admin))
            .status,
          400,
        );
        assert.equal(
          (
            await request(
              "users",
              "POST",
              {
                email: "new@example.test",
                name: "New editor",
                role: "user",
                password,
              },
              admin,
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "gallery CRUD, date validation and referenced media deletion",
      async () => {
        const gallery = {
          id: "gallery-test",
          kind: "gallery",
          title_sq: "Aktivitet testues",
          title_en: "Test activity",
          category_sq: "Seminare",
          category_en: "Seminars",
          media: previewId,
          published: true,
        };
        assert.equal(
          (
            await request(
              "gallery",
              "POST",
              { ...gallery, date: "2026-02-30" },
              editor,
            )
          ).status,
          400,
        );
        assert.equal(
          (await request("gallery", "POST", gallery, editor)).status,
          200,
        );
        assert.ok(
          (await (await fetch(`${origin}/en/gallery`)).text()).includes(
            "Test activity",
          ),
        );
        assert.equal(
          (await request(`media/${previewId}`, "DELETE", undefined, editor))
            .status,
          409,
        );
        assert.equal(
          (await request("gallery/gallery-test", "DELETE", undefined, editor))
            .status,
          200,
        );
        const unused = new FormData();
        unused.set(
          "file",
          new File([readFileSync("tests/fixtures/clip.mp4")], "unused.mp4"),
        );
        unused.set("private", "true");
        const uploaded = await (
          await request("media", "POST", unused, editor)
        ).json();
        assert.equal(
          (await request(`media/${uploaded.id}`, "DELETE", undefined, editor))
            .status,
          200,
        );
        assert.equal(
          (await request(`media/${uploaded.id}`, "GET", undefined, editor))
            .status,
          404,
        );
      },
    );
    if (process.env.BROWSER_QA === "true")
      await t.test(
        "browser: responsive pages, language switching, dashboard permissions and subscription UI",
        async () => {
          const { chromium } = await import("@playwright/test");
          const browser = await chromium.launch({ headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on("pageerror", (e) => errors.push(e.message));
            for (const width of [1440, 768, 390]) {
              await page.setViewportSize({ width, height: 1000 });
              await page.goto(`${origin}/sq`);
              await page.locator(".hero h1").waitFor();
              assert.equal(
                await page.locator("html").getAttribute("lang"),
                "sq",
              );
              assert.equal(
                await page.evaluate(
                  () => document.documentElement.scrollWidth > innerWidth,
                ),
                false,
                `overflow at ${width}`,
              );
              await page.screenshot({
                path: `test-results/home-${width}.png`,
                fullPage: true,
              });
            }
            await page.locator(".language-switch").click();
            await page.waitForURL("**/en");
            assert.ok(
              await page
                .getByRole("heading", { name: "Knowledge, put into practice." })
                .isVisible(),
            );
            for (const route of ["/en/about", "/sq/gallery", "/en/modules"]) {
              await page.goto(`${origin}${route}`);
              await page.locator("main h1").waitFor();
              assert.equal(
                await page.evaluate(
                  () => document.documentElement.scrollWidth > innerWidth,
                ),
                false,
                route,
              );
            }
            await page.goto(`${origin}/en/manage`);
            await page
              .getByLabel("Email address", { exact: true })
              .fill("editor@example.test");
            await page.getByLabel("Password", { exact: true }).fill(password);
            await page
              .getByRole("button", { name: "Sign in", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Modules", exact: true })
              .waitFor();
            await page.reload();
            await page
              .getByRole("button", { name: "Modules", exact: true })
              .waitFor();
            assert.equal(
              await page
                .getByRole("button", { name: "Settings", exact: true })
                .count(),
              0,
            );
            await page.screenshot({
              path: "test-results/editor-mobile.png",
              fullPage: true,
            });
            await page.goto(`${origin}/en/modules/${moduleId}`);
            assert.equal(await page.locator("main form").count(), 0);
            await page.goto(`${origin}/en/manage`);
            await page.getByRole("button", { name: "Sign out" }).click();
            await page
              .getByLabel("Email address", { exact: true })
              .fill("admin@example.test");
            await page.getByLabel("Password", { exact: true }).fill(password);
            await page
              .getByRole("button", { name: "Sign in", exact: true })
              .click();
            await page
              .getByRole("button", {
                name: "Content & translations",
                exact: true,
              })
              .click();
            await page
              .getByRole("row")
              .filter({ hasText: "English" })
              .getByRole("button", { name: "Edit" })
              .click();
            await page.screenshot({
              path: "test-results/translation-editor.png",
              fullPage: true,
            });
            await page
              .getByLabel("hero", { exact: true })
              .fill("Knowledge for clinical practice.");
            await page
              .getByRole("button", { name: "Save changes", exact: true })
              .click();
            await page
              .getByRole("status")
              .filter({ hasText: "Changes saved." })
              .waitFor();
            await page.goto(`${origin}/en`);
            assert.ok(
              await page
                .getByRole("heading", {
                  name: "Knowledge for clinical practice.",
                  exact: true,
                })
                .isVisible(),
            );
            const { verifyMedia } = await import("./media-browser");
            await verifyMedia(page, origin);
            assert.deepEqual(errors, []);
          } finally {
            await browser.close();
          }
        },
      );
    if (process.env.BROWSER_QA === "true")
      await t.test(
        "dashboard CRUD, bilingual content, publication and persistent storage for all four content areas",
        async () => {
          const { verifyCms } = await import("./cms-browser");
          await verifyCms(origin, password, previewId, fullId, testDirectory);
        },
      );
    await t.test(
      "Admin-only content rejects regular-user reads and mutations",
      async () => {
        for (const resource of [
          "contacts",
          "privacy",
          "doctors",
          "pages",
          "settings",
        ])
          for (const method of ["GET", "POST", "DELETE"]) {
            const response = await request(
              resource,
              method,
              method === "POST" ? {} : undefined,
              editor,
            );
            assert.equal(response.status, 403, resource + method);
          }
      },
    );
    await t.test("logout invalidates session", async () => {
      assert.equal(
        (await request("auth", "DELETE", undefined, editor)).status,
        200,
      );
      assert.equal(
        (await request("gallery", "GET", undefined, editor)).status,
        401,
      );
    });
  } finally {
    server.kill();
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve());
      setTimeout(resolve, 2000);
    });
    database.close();
    if (
      path.dirname(testDirectory) === path.resolve(tmpdir()) &&
      path.basename(testDirectory).startsWith("galenus-test-")
    )
      rmSync(testDirectory, { recursive: true, force: true });
  }
});
