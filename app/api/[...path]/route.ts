import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { writeFile, stat, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { z } from "zod";
import { db, dataDir, record, records, saveRecord } from "@/lib/db";
import { copy } from "@/lib/content";
import {
  allowed,
  cookieOptions,
  decryptEmail,
  emailHash,
  encryptEmail,
  hash,
  limit,
  newToken,
  passwordHash,
  requireOrigin,
  staff,
  verifyPassword,
} from "@/lib/security";
import {
  boundedForm,
  detectMedia,
  validateMedia,
} from "@/lib/media-validation";
import { newsletterAPI } from "@/lib/newsletter-api";
import { NewsletterError } from "@/lib/newsletter";
import { hasModuleAccess } from "@/lib/module-access";
import { recordSchema, userSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (code: string, status = 400) => json({ error: code }, status);
const dummyPassword = passwordHash(newToken());
type Context = { params: Promise<{ path: string[] }> };
type Media = {
  id: string;
  name: string;
  mime: string;
  private: number;
  size: number;
};
async function handle(req: NextRequest, context: Context) {
  const parts = (await context.params).path;
  const [section, id] = parts;
  try {
    if (req.method !== "GET") requireOrigin(req);
    const current = await staff();
    const newsletter = await newsletterAPI(req, parts, current);
    if (newsletter) return newsletter;
    if (section === "auth") {
      if (req.method === "GET") return json({ user: current || null });
      if (req.method === "DELETE") {
        const token = (await cookies()).get("gma_session")?.value;
        if (token)
          db().prepare("DELETE FROM sessions WHERE token=?").run(hash(token));
        (await cookies()).set("gma_session", "", {
          ...cookieOptions,
          maxAge: 0,
        });
        return json({ ok: true });
      }
      if (req.method !== "POST") return fail("invalid", 405);
      const input = z
        .object({
          email: z.string().email().max(254),
          password: z.string().max(128),
        })
        .parse(await req.json());
      if (
        !limit("login-global", 150) ||
        !limit(`login:${hash(input.email.toLowerCase())}`, 10)
      )
        return fail("rateLimit", 429);
      const user = db()
        .prepare("SELECT * FROM users WHERE email=?")
        .get(input.email.toLowerCase()) as
        { id: string; password: string } | undefined;
      const valid = verifyPassword(
        input.password,
        user?.password || dummyPassword,
      );
      if (!user || !valid) return fail("loginError", 401);
      db().prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      const token = newToken();
      db()
        .prepare("INSERT INTO sessions VALUES (?,?,?)")
        .run(hash(token), user.id, Date.now() + 8 * 3600000);
      (await cookies()).set("gma_session", token, {
        ...cookieOptions,
        maxAge: 8 * 3600,
      });
      return json({ ok: true });
    }
    if (section === "subscribe") return fail("unavailable", 410);
    if (
      (section === "media" || section === "watch" || section === "resources") &&
      req.method === "GET" &&
      id
    ) {
      let mediaId = id;
      let protectedVideo = false;
      if (section === "watch") {
        const module = record(id);
        if (
          !module ||
          module.kind !== "modules" ||
          !module.published ||
          !module.fullMedia
        )
          return fail("unavailable", 404);
        if (!(await hasModuleAccess(id, current)))
          return fail("accessDenied", 403);
        mediaId = String(module.fullMedia);
        protectedVideo = true;
      }
      if (section === "resources") {
        const module = record(id),
          resource = Array.isArray(module?.resources)
            ? module.resources.find((r) => r.id === parts[2])
            : undefined;
        if (
          module?.kind !== "modules" ||
          !module.published ||
          !resource?.published
        )
          return fail("unavailable", 404);
        if (!(await hasModuleAccess(id, current)))
          return fail("accessDenied", 403);
        mediaId = resource.media;
        protectedVideo = true;
      }
      const media = db()
        .prepare("SELECT * FROM media WHERE id=?")
        .get(mediaId) as Media | undefined;
      if (!media) return fail("unavailable", 404);
      if (media.private && !current && !protectedVideo)
        return fail("accessDenied", 403);
      const file = path.join(dataDir, "media", media.id),
        size = (await stat(file)).size;
      let start = 0,
        end = size - 1,
        status = 200;
      const range = req.headers.get("range");
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]))
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        if (!match[1]) start = Math.max(0, size - Number(match[2]));
        else start = Number(match[1]);
        end =
          match[1] && match[2]
            ? Math.min(Number(match[2]), size - 1)
            : size - 1;
        if (start > end || start >= size)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${size}` },
          });
        status = 206;
      }
      const headers: Record<string, string> = {
        "Content-Type": media.mime,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control":
          media.private || protectedVideo
            ? "private, no-store"
            : "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      };
      if (media.mime === "application/pdf") {
        headers["Content-Disposition"] = "attachment; filename=material.pdf";
        headers["Content-Security-Policy"] =
          "default-src 'none'; frame-ancestors 'none'";
        headers["X-Frame-Options"] = "DENY";
      }
      if (status === 206)
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
      return new Response(
        Readable.toWeb(
          createReadStream(file, { start, end }),
        ) as ReadableStream,
        { status, headers },
      );
    }
    if (!current) return fail("accessDenied", 401);
    if (!allowed(current.role, section)) return fail("accessDenied", 403);
    if (section === "media") {
      if (req.method === "GET")
        return json(
          db().prepare("SELECT * FROM media ORDER BY rowid DESC").all(),
        );
      if (req.method === "DELETE") {
        const item = db().prepare("SELECT id FROM media WHERE id=?").get(id);
        if (!item) return fail("invalid", 404);
        const used = (
          db().prepare("SELECT data FROM records").all() as { data: string }[]
        ).some((r) => {
          const value = JSON.parse(r.data);
          return (
            Object.values(value).includes(id) ||
            (Array.isArray(value.resources) &&
              value.resources.some(
                (item: { media: string }) => item.media === id,
              ))
          );
        });
        if (used) return fail("mediaInUse", 409);
        await unlink(path.join(dataDir, "media", id));
        db().prepare("DELETE FROM media WHERE id=?").run(id);
        return json({ ok: true });
      }
      if (req.method !== "POST") return fail("invalid", 405);
      const maxSize = 100 * 1024 * 1024;
      if (
        Number(req.headers.get("content-length") || 0) >
        maxSize + 1024 * 1024
      )
        return fail("fileTooLarge", 413);
      let form: FormData;
      try {
        form = await boundedForm(req, maxSize + 1024 * 1024);
      } catch (error) {
        return error instanceof Error && error.message === "fileTooLarge"
          ? fail("fileTooLarge", 413)
          : fail("invalidMedia");
      }
      const file = form.get("file"),
        isPrivate = form.get("private") === "true";
      if (!(file instanceof File)) return fail("invalidMedia");
      if (file.size > maxSize) return fail("fileTooLarge", 413);
      if (!/\.(jpe?g|png|webp|mp4|webm|pdf)$/i.test(file.name))
        return fail("unsupportedMedia");
      const bytes = Buffer.from(await file.arrayBuffer());
      const mime = detectMedia(bytes);
      if (!mime) return fail("invalidMedia");
      if (mime === "application/pdf" && file.size > 20 * 1024 * 1024)
        return fail("pdfTooLarge", 413);
      const mediaId = randomUUID(),
        location = path.join(dataDir, "media", mediaId);
      await writeFile(location, bytes, { flag: "wx" });
      try {
        await validateMedia(location, mime);
      } catch {
        await unlink(location);
        return fail("invalidMedia");
      }
      try {
        db()
          .prepare("INSERT INTO media VALUES (?,?,?,?,?)")
          .run(
            mediaId,
            file.name.slice(0, 200),
            mime,
            isPrivate ? 1 : 0,
            file.size,
          );
      } catch (error) {
        await unlink(location);
        throw error;
      }
      return json({ id: mediaId }, 201);
    }
    if (section === "subscriptions") {
      if (req.method === "GET")
        return json(
          (
            db()
              .prepare(
                "SELECT id,module,email,first_name,last_name,registered_at FROM subscriptions ORDER BY registered_at DESC",
              )
              .all() as {
              email: string;
              first_name: string;
              last_name: string;
            }[]
          ).map((r) => ({
            ...r,
            email: decryptEmail(r.email),
            first_name: r.first_name ? decryptEmail(r.first_name) : "",
            last_name: r.last_name ? decryptEmail(r.last_name) : "",
          })),
        );
      if (req.method === "DELETE") {
        db().prepare("DELETE FROM subscriptions WHERE id=?").run(id);
        return json({ ok: true });
      }
      return fail("invalid", 405);
    }
    if (section === "users") {
      if (req.method === "GET")
        return json(db().prepare("SELECT id,email,name,role FROM users").all());
      if (req.method === "DELETE") {
        if (id === current.id) return fail("invalid");
        db().prepare("DELETE FROM users WHERE id=?").run(id);
        return json({ ok: true });
      }
      if (req.method !== "POST") return fail("invalid", 405);
      const input = userSchema.parse(await req.json());
      if (input.id === current.id && input.role !== "admin")
        return fail("invalid");
      if (input.id) {
        if (input.password) {
          db()
            .prepare(
              "UPDATE users SET email=?,name=?,role=?,password=? WHERE id=?",
            )
            .run(
              input.email,
              input.name,
              input.role,
              passwordHash(input.password),
              input.id,
            );
        } else
          db()
            .prepare("UPDATE users SET email=?,name=?,role=? WHERE id=?")
            .run(input.email, input.name, input.role, input.id);
        db().prepare("DELETE FROM sessions WHERE user_id=?").run(input.id);
      } else {
        if (!input.password) return fail("invalid");
        db()
          .prepare("INSERT INTO users VALUES (?,?,?,?,?)")
          .run(
            randomUUID(),
            input.email,
            input.name,
            passwordHash(input.password),
            input.role,
          );
      }
      return json({ ok: true });
    }
    if (
      ![
        "gallery",
        "modules",
        "doctors",
        "pages",
        "settings",
        "contacts",
      ].includes(section)
    )
      return fail("invalid", 404);
    if (req.method === "GET") {
      const result = records(section);
      return json(
        section === "pages"
          ? result.map((r) => ({
              ...copy[r.id === "copy-sq" ? "sq" : "en"],
              ...r,
            }))
          : result,
      );
    }
    if (req.method === "DELETE") {
      if (["pages", "settings"].includes(section)) return fail("invalid");
      const existing = record(id);
      if (existing?.kind !== section) return fail("invalid");
      db().prepare("DELETE FROM records WHERE id=?").run(id);
      if (section === "modules") {
        db().prepare("DELETE FROM subscriptions WHERE module=?").run(id);
        db().prepare("DELETE FROM grants WHERE module=?").run(id);
      }
      return json({ ok: true });
    }
    if (req.method !== "POST") return fail("invalid", 405);
    if (Number(req.headers.get("content-length") || 0) > 250000)
      return fail("invalid", 413);
    const raw = await req.json();
    let value;
    if (section === "pages") {
      if (!["copy-sq", "copy-en"].includes(raw.id)) return fail("invalid");
      const shape = Object.fromEntries(
        Object.keys(copy.en).map((k) => [k, z.string().min(1).max(12000)]),
      );
      value = { ...z.object(shape).parse(raw), id: raw.id, kind: section };
    } else if (section === "settings") {
      value = {
        ...z
          .object({
            siteName: z.string().min(1).max(100),
            heroMedia: z.string().uuid().or(z.literal("")).optional(),
            navigation: z
              .array(z.enum(["home", "about", "gallery", "modules"]))
              .min(1)
              .max(4),
          })
          .parse(raw),
        id: "settings",
        kind: section,
      };
      if (value.heroMedia) {
        const hero = db()
          .prepare("SELECT mime,private FROM media WHERE id=?")
          .get(value.heroMedia) as Media | undefined;
        if (!hero || hero.private || !hero.mime.startsWith("image/"))
          return fail("invalid");
      }
    } else {
      value = recordSchema.parse({ ...raw, kind: section });
      if (
        section === "modules" &&
        value.published &&
        !value.placeholder &&
        (!value.title_sq?.trim() ||
          !value.title_en?.trim() ||
          !value.description_sq?.trim() ||
          !value.description_en?.trim() ||
          !value.thumbnail)
      )
        return fail("moduleIncomplete");
      if (section === "contacts" && value.id !== "contact-details")
        return fail("invalid");
      if (value.resources?.length && section !== "modules")
        return fail("invalid");
      for (const resource of value.resources || []) {
        const asset = db()
          .prepare("SELECT mime,private FROM media WHERE id=?")
          .get(resource.media) as Media | undefined;
        if (!asset || !asset.private) return fail("resourcePrivate");
        resource.mime = asset.mime;
      }
      const existing = record(value.id);
      if (existing && existing.kind !== section) return fail("invalid");
      for (const field of ["thumbnail", "media", "fullMedia"] as const) {
        const mediaId = value[field];
        if (!mediaId) continue;
        const m = db()
          .prepare("SELECT * FROM media WHERE id=?")
          .get(mediaId) as Media | undefined;
        if (!m) return fail("invalid");
        if (
          field === "fullMedia" &&
          (!m.private || !m.mime.startsWith("video/"))
        )
          return fail("invalid");
        if (field !== "fullMedia" && m.private) return fail("invalid");
        if (field === "media" && !/^(image|video)\//.test(m.mime))
          return fail("invalid");
        if (field === "thumbnail" && !m.mime.startsWith("image/"))
          return fail("invalid");
      }
    }
    saveRecord(value);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof NewsletterError) return fail(error.code, error.status);
    if (error instanceof z.ZodError) return fail("invalid");
    if (error instanceof Error && error.message === "origin")
      return fail("accessDenied", 403);
    console.error(
      "API failure",
      error instanceof Error ? error.name : "unknown",
    );
    return fail("error", 500);
  }
}
export { handle as GET, handle as POST, handle as DELETE };
