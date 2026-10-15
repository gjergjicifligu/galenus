import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, ChildProcess } from "node:child_process";
import { SMTPServer } from "smtp-server";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
const directory = mkdtempSync(path.join(tmpdir(), "galenus-newsletter-"));
process.env.DATA_DIR = directory;
process.env.SUBSCRIPTION_KEY = randomBytes(32).toString("hex");
const origin = "http://localhost:3218";
test("Newsletter, resources and SMTP campaign integration", async (t) => {
  const { db, saveRecord } = await import("../lib/db");
  const { passwordHash, decryptEmail, hash } = await import("../lib/security");
  const database = db(),
    password = randomBytes(24).toString("base64url"),
    adminId = randomUUID(),
    userId = randomUUID();
  for (const [id, email, role] of [
    [adminId, "admin@example.test", "admin"],
    [userId, "editor@example.test", "user"],
  ])
    database
      .prepare("INSERT INTO users VALUES (?,?,?,?,?)")
      .run(id, email, role, passwordHash(password), role);
  const rejected = new Set<string>(),
    messages: { to: string[]; raw: string }[] = [];
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    onRcptTo(address, _session, callback) {
      if (rejected.has(address.address)) {
        const error = new Error("Temporary fixture rejection") as Error & {
          responseCode: number;
        };
        error.responseCode = 450;
        callback(error);
      } else callback();
    },
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk) => (raw += chunk));
      stream.on("end", () => {
        messages.push({
          to: session.envelope.rcptTo.map((r) => r.address),
          raw: raw
            .replace(/=\r?\n/g, "")
            .replace(/=([A-F\d]{2})/gi, (_, code) =>
              String.fromCharCode(parseInt(code, 16)),
            ),
        });
        callback();
      });
    },
  });
  await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  const smtpPort = (smtp.server.address() as { port: number }).port;
  let server: ChildProcess | undefined,
    logs = "",
    admin = "",
    editor = "";
  async function stop() {
    if (server && server.exitCode === null) {
      const ended = new Promise<void>((resolve) =>
        server!.once("exit", () => resolve()),
      );
      server.kill();
      await ended;
    }
  }
  async function start(configured: boolean) {
    await stop();
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "-p", "3218"],
      {
        env: {
          ...process.env,
          APP_ORIGIN: origin,
          COOKIE_SECURE: "false",
          SMTP_HOST: configured ? "127.0.0.1" : "",
          SMTP_PORT: String(smtpPort),
          SMTP_SECURE: "false",
          SMTP_ALLOW_INSECURE_LOCAL: "true",
          SMTP_FROM: configured ? "academy@example.test" : "",
          SMTP_USER: "",
          SMTP_PASSWORD: "",
        },
        stdio: "pipe",
      },
    );
    server.stdout?.on("data", (b) => (logs += b));
    server.stderr?.on("data", (b) => (logs += b));
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(`${origin}/en`)).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(logs);
  }
  async function request(
    endpoint: string,
    method = "GET",
    data?: unknown,
    cookie = admin,
  ) {
    return fetch(`${origin}/api/${endpoint}`, {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        data instanceof FormData
          ? data
          : data
            ? JSON.stringify(data)
            : undefined,
    });
  }
  async function json(
    endpoint: string,
    method = "GET",
    data?: unknown,
    cookie = admin,
  ) {
    const res = await request(endpoint, method, data, cookie);
    const result = await res.json();
    assert.ok(
      res.ok,
      `${endpoint} ${res.status} ${JSON.stringify(result)} ${logs}`,
    );
    return result;
  }
  async function upload(
    name: string,
    bytes: Uint8Array,
    privateMedia: boolean,
  ) {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(bytes)], name));
    form.set("private", String(privateMedia));
    return (await json("media", "POST", form, editor)).id as string;
  }
  let image = "",
    video = "",
    pdf = "",
    privateImage = "",
    resourceIds: string[] = [],
    campaign = "",
    revision = "",
    people: { id: string; email: string }[] = [];
  const moduleId = "newsletter-module",
    secondModule = "second-module";
  try {
    await start(false);
    for (const [email, set] of [
      ["admin@example.test", (cookie: string) => (admin = cookie)],
      ["editor@example.test", (cookie: string) => (editor = cookie)],
    ] as const) {
      const res = await request("auth", "POST", { email, password }, "");
      assert.equal(res.status, 200);
      set(res.headers.get("set-cookie")!.split(";")[0]);
    }
    await t.test(
      "general subscriptions require consent, deduplicate emails, encrypt personal details and stay separate from modules",
      async () => {
        for (const invalid of [
          { firstName: "A", lastName: "B", email: "bad", consent: true },
          {
            firstName: "A",
            lastName: "B",
            email: "x@example.test",
            consent: false,
          },
          {
            firstName: " ",
            lastName: "B",
            email: "x@example.test",
            consent: true,
          },
        ])
          assert.equal(
            (await request("newsletter/subscribe", "POST", invalid, "")).status,
            400,
          );
        for (const [email, language] of [
          ["ada@example.test", "sq"],
          ["grace@example.test", "en"],
          ["fallback@example.test", undefined],
        ] as const)
          await json(
            "newsletter/subscribe",
            "POST",
            {
              firstName: email.split("@")[0],
              lastName: "Newsletter",
              email,
              language,
              consent: true,
            },
            "",
          );
        await json(
          "newsletter/subscribe",
          "POST",
          {
            firstName: "Ada",
            lastName: "Newsletter",
            email: " ADA@example.test ",
            language: "sq",
            consent: true,
          },
          "",
        );
        assert.equal(
          database
            .prepare("SELECT COUNT(*) AS count FROM newsletter_subscribers")
            .get()!.count,
          3,
        );
        assert.equal(
          database.prepare("SELECT COUNT(*) AS count FROM subscriptions").get()!
            .count,
          0,
        );
        const stored = database
          .prepare(
            "SELECT email,first_name FROM newsletter_subscribers LIMIT 1",
          )
          .get() as { email: string; first_name: string };
        assert.ok(!stored.email.includes("@"));
        assert.equal(decryptEmail(stored.first_name), "Ada");
        people = await json("newsletter/subscribers");
        for (const route of ["newsletter/subscribers", "campaigns"])
          for (const method of ["GET", "POST"])
            assert.equal(
              (
                await request(
                  route,
                  method,
                  method === "POST" ? {} : undefined,
                  editor,
                )
              ).status,
              403,
            );
        assert.equal(
          (await request("newsletter/subscribers", "GET", undefined, ""))
            .status,
          401,
        );
      },
    );
    await t.test(
      "image/video/PDF module resources validate, persist, preview to staff and remain private",
      async () => {
        image = await upload(
          "public.png",
          readFileSync("tests/fixtures/photo.png"),
          false,
        );
        privateImage = await upload(
          "resource.png",
          readFileSync("tests/fixtures/photo.png"),
          true,
        );
        video = await upload(
          "resource.mp4",
          readFileSync("tests/fixtures/clip.mp4"),
          true,
        );
        const doc = await PDFDocument.create();
        doc
          .addPage()
          .drawText("Galenus test resource", { x: 40, y: 700, size: 24 });
        const pdfBytes = await doc.save();
        pdf = await upload("resource.pdf", pdfBytes, true);
        const malicious = await PDFDocument.create();
        malicious.addPage();
        malicious.catalog.set(
          PDFName.of("OpenAction"),
          malicious.context.obj({
            S: "JavaScript",
            JS: PDFString.of("alert(1)"),
          }),
        );
        for (const bytes of [
          Buffer.from("%PDF-1.7 broken"),
          await malicious.save(),
        ]) {
          const form = new FormData();
          form.set("file", new File([new Uint8Array(bytes)], "invalid.pdf"));
          assert.equal(
            (await request("media", "POST", form, editor)).status,
            400,
          );
        }
        resourceIds = [randomUUID(), randomUUID(), randomUUID()];
        const resources = [privateImage, video, pdf].map((media, i) => ({
          id: resourceIds[i],
          media,
          title_sq: `Material SQ ${i}`,
          title_en: `Resource EN ${i}`,
          description_sq: "Përshkrim",
          description_en: "Description",
          language: "both",
          order: 2 - i,
          published: true,
        }));
        const module = {
          id: moduleId,
          kind: "modules",
          title_sq: "Moduli SQ",
          title_en: "Newsletter module",
          description_sq: "Paragrafi i parë.\n\nParagrafi i dytë.",
          description_en: "First paragraph.\n\nSecond paragraph.",
          thumbnail: image,
          published: true,
          resources,
        };
        assert.equal(
          (
            await request(
              "modules",
              "POST",
              { ...module, resources: [{ ...resources[0], media: image }] },
              editor,
            )
          ).status,
          400,
        );
        await json("modules", "POST", module, editor);
        await json(
          "modules",
          "POST",
          {
            ...module,
            id: secondModule,
            title_en: "Second module",
            resources: [],
          },
          editor,
        );
        for (const id of [privateImage, video, pdf]) {
          assert.equal(
            (await request(`media/${id}`, "GET", undefined, "")).status,
            403,
          );
          assert.equal(
            (await request(`media/${id}`, "GET", undefined, editor)).status,
            200,
          );
          assert.equal(
            (await request(`media/${id}`, "DELETE", undefined, editor)).status,
            409,
          );
        }
        const pdfResponse = await request(
          `media/${pdf}`,
          "GET",
          undefined,
          editor,
        );
        assert.equal(
          pdfResponse.headers.get("content-type"),
          "application/pdf",
        );
        assert.equal(pdfResponse.headers.get("x-frame-options"), "DENY");
        assert.equal(
          (
            await request(
              `resources/${moduleId}/${resourceIds[2]}`,
              "GET",
              undefined,
              "",
            )
          ).status,
          403,
        );
        for (const lang of ["sq", "en"]) {
          const html = await (
            await fetch(`${origin}/${lang}/modules/${moduleId}`)
          ).text();
          assert.ok(!html.includes("<form"));
          for (const privateId of [privateImage, video, pdf])
            assert.ok(!html.includes(privateId));
        }
      },
    );
    await t.test(
      "campaign draft and preview work without SMTP but sending and testing fail honestly",
      async () => {
        const draft = await json("campaigns", "POST", {
          name: "Educational modules",
          subject_sq: "Modulet edukative",
          subject_en: "Educational modules",
          intro_sq: "Hyrje",
          intro_en: "Introduction",
          modules: [moduleId],
          subscribers: people.map((p) => p.id),
        });
        campaign = draft.id;
        const detail = await json(`campaigns/${campaign}`);
        revision = detail.revision;
        assert.ok(detail.previews.en.html.includes("Newsletter module"));
        assert.ok(detail.previews.sq.html.includes("Moduli SQ"));
        assert.ok(detail.previews.en.html.includes(`/api/media/${image}`));
        assert.ok(!detail.previews.en.html.includes(video));
        assert.equal(
          (
            await request(
              `campaigns/${campaign}/send`,
              "POST",
              { confirm: true, revision },
              editor,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(`campaigns/${campaign}/send`, "POST", {
              confirm: true,
              revision,
            })
          ).status,
          503,
        );
        assert.equal(
          (
            await request(`campaigns/${campaign}/test`, "POST", {
              email: "test@example.test",
              language: "en",
            })
          ).status,
          503,
        );
        assert.equal((await json(`campaigns/${campaign}`)).started_at, null);
        assert.equal(messages.length, 0);
      },
    );
    await start(true);
    await t.test(
      "test email, language-specific send, delivery logs and safe retry",
      async () => {
        await json(`campaigns/${campaign}/test`, "POST", {
          email: "test@example.test",
          language: "en",
        });
        assert.equal(messages.length, 1);
        assert.ok(messages[0].raw.includes("[TEST]"));
        assert.equal(
          (await json(`campaigns/${campaign}`)).tests[0].status,
          "accepted",
        );
        assert.equal(
          (
            await request(`campaigns/${campaign}/send`, "POST", {
              confirm: false,
              revision,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request(`campaigns/${campaign}/send`, "POST", {
              confirm: true,
              revision: "stale",
            })
          ).status,
          409,
        );
        rejected.add("grace@example.test");
        await Promise.all(
          [0, 1].map(() =>
            json(`campaigns/${campaign}/send`, "POST", {
              confirm: true,
              revision,
            }),
          ),
        );
        let result = await json(`campaigns/${campaign}`);
        assert.equal(
          messages.filter((m) => m.to.includes("ada@example.test")).length,
          1,
        );
        assert.equal(
          result.recipients.filter(
            (r: { status: string }) => r.status === "accepted",
          ).length,
          2,
        );
        assert.equal(
          result.recipients.filter(
            (r: { status: string }) => r.status === "failed",
          ).length,
          1,
        );
        const before = messages.length;
        await json(`campaigns/${campaign}/send`, "POST", {
          confirm: true,
          revision,
        });
        assert.equal(messages.length, before);
        rejected.clear();
        result = await json(`campaigns/${campaign}/send`, "POST", {
          confirm: true,
          revision,
          retry: true,
        });
        assert.equal(
          result.recipients.filter(
            (r: { status: string }) => r.status === "accepted",
          ).length,
          3,
        );
        assert.equal(messages.length, before + 1);
        for (const [email, language] of [
          ["ada@example.test", "sq"],
          ["grace@example.test", "en"],
          ["fallback@example.test", "sq"],
        ]) {
          const mail = messages.find((m) => m.to.includes(email))!;
          assert.ok(mail.raw.includes(`<html lang="${language}">`));
          assert.ok(mail.raw.includes("/api/access/"));
          assert.ok(mail.raw.includes("/unsubscribe?token="));
        }
        assert.equal(
          (
            await request("campaigns", "POST", {
              id: campaign,
              name: "Change",
              subject_sq: "Changed",
              modules: [moduleId],
              subscribers: people.map((p) => p.id),
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "secure email links grant only the selected module; invalid or expired links fail",
      async () => {
        const mail = messages.find((m) => m.to.includes("ada@example.test"))!;
        const token = mail.raw.match(/\/api\/access\/([a-f0-9]{64})/)![1];
        const res = await fetch(`${origin}/api/access/${token}`, {
          redirect: "manual",
        });
        assert.equal(res.status, 307);
        const grant = res.headers.get("set-cookie")!.split(";")[0];
        for (const resource of resourceIds)
          assert.equal(
            (
              await request(
                `resources/${moduleId}/${resource}`,
                "GET",
                undefined,
                grant,
              )
            ).status,
            200,
          );
        assert.equal(
          (await request(`media/${pdf}`, "GET", undefined, grant)).status,
          403,
        );
        const originalModule = JSON.parse(
          (
            database
              .prepare("SELECT data FROM records WHERE id=?")
              .get(moduleId) as { data: string }
          ).data,
        );
        await json(
          "modules",
          "POST",
          {
            ...originalModule,
            resources: originalModule.resources.map((r: { id: string }) => ({
              ...r,
              published: false,
            })),
          },
          editor,
        );
        assert.equal(
          (
            await request(
              `resources/${moduleId}/${resourceIds[0]}`,
              "GET",
              undefined,
              grant,
            )
          ).status,
          404,
        );
        await json("modules", "POST", originalModule, editor);
        const second = database
          .prepare("SELECT data FROM records WHERE id=?")
          .get(secondModule) as { data: string };
        saveRecord({
          ...JSON.parse(second.data),
          resources: [
            {
              ...JSON.parse(
                (
                  database
                    .prepare("SELECT data FROM records WHERE id=?")
                    .get(moduleId) as { data: string }
                ).data,
              ).resources[0],
            },
          ],
        });
        assert.equal(
          (
            await request(
              `resources/${secondModule}/${resourceIds[0]}`,
              "GET",
              undefined,
              grant,
            )
          ).status,
          403,
        );
        database
          .prepare("UPDATE newsletter_links SET expires=0 WHERE token=?")
          .run(hash(token));
        assert.equal(
          (await fetch(`${origin}/api/access/${token}`)).status,
          404,
        );
        assert.equal(
          (await fetch(`${origin}/api/access/${"0".repeat(64)}`)).status,
          404,
        );
      },
    );
    await t.test(
      "unsubscribe confirmation is idempotent and suppresses already selected recipients",
      async () => {
        const grace = people.find((p) => p.email === "grace@example.test")!,
          draft = await json("campaigns", "POST", {
            name: "Unsubscribe check",
            subject_sq: "Modulet",
            modules: [moduleId],
            subscribers: [grace.id],
          });
        const mail = messages.find((m) => m.to.includes(grace.email))!,
          token = mail.raw.match(/unsubscribe\?token=([a-f0-9]{64})/)![1];
        assert.equal(
          (await fetch(`${origin}/en/unsubscribe?token=${token}`)).status,
          200,
        );
        assert.equal(
          database
            .prepare("SELECT status FROM newsletter_subscribers WHERE id=?")
            .get(grace.id)!.status,
          "active",
        );
        await json("newsletter/unsubscribe", "POST", { token }, "");
        await json("newsletter/unsubscribe", "POST", { token }, "");
        const before = messages.length,
          detail = await json(`campaigns/${draft.id}`);
        const sent = await json(`campaigns/${draft.id}/send`, "POST", {
          confirm: true,
          revision: detail.revision,
        });
        assert.equal(sent.recipients[0].status, "skipped");
        assert.equal(messages.length, before);
        assert.equal(
          (
            await request("campaigns", "POST", {
              name: "Invalid recipient",
              subject_sq: "Modulet",
              modules: [moduleId],
              subscribers: [grace.id],
            })
          ).status,
          400,
        );
      },
    );
    await start(true);
    await t.test(
      "send state persists across restart and interrupted claims are not blindly retried",
      async () => {
        const before = messages.length;
        await json(`campaigns/${campaign}/send`, "POST", {
          confirm: true,
          revision,
          retry: true,
        });
        assert.equal(messages.length, before);
        const draft = await json("campaigns", "POST", {
          name: "Interrupted",
          subject_sq: "Modulet",
          modules: [moduleId],
          subscribers: [people[0].id],
        });
        database
          .prepare(
            "UPDATE campaign_recipients SET status='sending',attempted_at=?,attempts=1 WHERE campaign=?",
          )
          .run(Date.now() - 600000, draft.id);
        const detail = await json(`campaigns/${draft.id}`);
        assert.equal(detail.recipients[0].status, "uncertain");
        await json(`campaigns/${draft.id}/send`, "POST", {
          confirm: true,
          revision: detail.revision,
          retry: true,
        });
        assert.equal(messages.length, before);
      },
    );
    if (process.env.BROWSER_QA === "true")
      await t.test(
        "browser newsletter forms, module resources, campaign selection and send controls",
        async () => {
          const { verifyNewsletterBrowser } =
            await import("./newsletter-browser");
          await verifyNewsletterBrowser(origin, password, image);
        },
      );
  } finally {
    await stop();
    await new Promise<void>((resolve) => smtp.close(() => resolve()));
    database.close();
    if (
      path.dirname(directory) === path.resolve(tmpdir()) &&
      path.basename(directory).startsWith("galenus-newsletter-")
    )
      rmSync(directory, { recursive: true, force: true });
  }
});
