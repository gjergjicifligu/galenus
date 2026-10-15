import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import { db, record, dictionary } from "./db";
import {
  decryptEmail,
  encryptEmail,
  emailHash,
  hash,
  newToken,
  limit,
} from "./security";
import { Lang, localized, RecordData } from "./content";

export class NewsletterError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
type Subscriber = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  language: Lang;
  status: string;
  unsubscribe_token: string;
};
type Campaign = {
  id: string;
  name: string;
  subject_sq: string;
  subject_en: string;
  intro_sq: string;
  intro_en: string;
  modules: string;
  revision: string;
  started_at: string | null;
};
type Recipient = {
  subscriber: string;
  email: string;
  first_name: string;
  last_name: string;
  language: Lang;
  status: string;
  attempts: number;
};
const now = () => new Date().toISOString();
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const newsletterInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
  language: z.enum(["sq", "en"]).default("sq"),
});
export function subscribeNewsletter(raw: unknown) {
  const parsed = newsletterInput.safeParse(raw);
  if (!parsed.success) throw new NewsletterError("newsletterInvalid");
  const input = parsed.data,
    email = input.email.toLowerCase(),
    fingerprint = emailHash(email);
  if (
    !limit("newsletter-global", 100) ||
    !limit(`newsletter:${fingerprint}`, 10)
  )
    throw new NewsletterError("rateLimit", 429);
  const token = newToken();
  db()
    .prepare(
      `INSERT INTO newsletter_subscribers(id,email,email_hash,first_name,last_name,language,status,consent_at,consent_text,unsubscribe_token,unsubscribe_hash)
 VALUES (?,?,?,?,?,?,'active',?,?,?,?) ON CONFLICT(email_hash) DO UPDATE SET
 first_name=excluded.first_name,last_name=excluded.last_name,language=excluded.language,status='active',consent_at=excluded.consent_at,consent_text=excluded.consent_text,unsubscribed_at=NULL`,
    )
    .run(
      randomUUID(),
      encryptEmail(email),
      fingerprint,
      encryptEmail(input.firstName),
      encryptEmail(input.lastName),
      input.language,
      now(),
      dictionary(input.language).newsletterConsent,
      encryptEmail(token),
      hash(token),
    );
  return { ok: true };
}
export function subscriberForToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return undefined;
  return db()
    .prepare("SELECT * FROM newsletter_subscribers WHERE unsubscribe_hash=?")
    .get(hash(token)) as Subscriber | undefined;
}
export function unsubscribeNewsletter(token: string) {
  const subscriber = subscriberForToken(token);
  if (!subscriber) throw new NewsletterError("invalidLink", 404);
  db()
    .prepare(
      "UPDATE newsletter_subscribers SET status='unsubscribed',unsubscribed_at=? WHERE id=?",
    )
    .run(now(), subscriber.id);
  return { ok: true };
}
export function listSubscribers() {
  return (
    db()
      .prepare(
        "SELECT id,email,first_name,last_name,language,status,consent_at,unsubscribed_at FROM newsletter_subscribers ORDER BY consent_at DESC",
      )
      .all() as Subscriber[]
  ).map((s) => ({
    ...s,
    email: decryptEmail(s.email),
    first_name: decryptEmail(s.first_name),
    last_name: decryptEmail(s.last_name),
  }));
}
export function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM);
}
export function mailTransport() {
  if (!smtpConfigured()) throw new NewsletterError("smtpMissing", 503);
  const host = process.env.SMTP_HOST!,
    secure = process.env.SMTP_SECURE === "true";
  const insecure =
    process.env.SMTP_ALLOW_INSECURE_LOCAL === "true" &&
    ["localhost", "127.0.0.1", "::1"].includes(host);
  const from = z.string().email().safeParse(process.env.SMTP_FROM);
  if (!from.success) throw new NewsletterError("smtpFailed", 503);
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || (secure ? 465 : 587)),
    secure,
    requireTLS: !secure && !insecure,
    ignoreTLS: insecure,
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD || "",
          },
        }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: true },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
function origin() {
  return new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin;
}
function getCampaign(id: string) {
  const campaign = db()
    .prepare("SELECT * FROM campaigns WHERE id=?")
    .get(id) as Campaign | undefined;
  if (!campaign) throw new NewsletterError("unavailable", 404);
  return campaign;
}
export const campaignInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  subject_sq: z.string().trim().min(1).max(200),
  subject_en: z.string().max(200).default(""),
  intro_sq: z.string().max(5000).default(""),
  intro_en: z.string().max(5000).default(""),
  modules: z.array(z.string().max(100)).min(1).max(50),
  subscribers: z.array(z.string().uuid()).min(1).max(500),
});
export function saveCampaign(raw: unknown, staffId: string) {
  const parsed = campaignInput.safeParse(raw);
  if (!parsed.success) throw new NewsletterError("campaignInvalid");
  const input = parsed.data,
    id = input.id || randomUUID();
  const modules = [...new Set(input.modules)].map((id) => {
    const r = record(id);
    if (r?.kind !== "modules" || !r.published)
      throw new NewsletterError("campaignInvalid");
    return {
      id: r.id,
      kind: "modules",
      title_sq: r.title_sq,
      title_en: r.title_en,
      description_sq: r.description_sq,
      description_en: r.description_en,
      thumbnail: r.thumbnail,
    };
  });
  const subscribers = [...new Set(input.subscribers)].map((id) => {
    const s = db()
      .prepare(
        "SELECT * FROM newsletter_subscribers WHERE id=? AND status='active'",
      )
      .get(id) as Subscriber | undefined;
    if (!s) throw new NewsletterError("campaignInvalid");
    return s;
  });
  const database = db();
  database
    .prepare("DELETE FROM newsletter_links WHERE expires<?")
    .run(Date.now());
  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = database
      .prepare("SELECT started_at FROM campaigns WHERE id=?")
      .get(id);
    if (existing?.started_at) throw new NewsletterError("campaignLocked", 409);
    database
      .prepare(
        `INSERT INTO campaigns VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,subject_sq=excluded.subject_sq,subject_en=excluded.subject_en,intro_sq=excluded.intro_sq,intro_en=excluded.intro_en,modules=excluded.modules,revision=excluded.revision`,
      )
      .run(
        id,
        input.name,
        input.subject_sq,
        input.subject_en,
        input.intro_sq,
        input.intro_en,
        JSON.stringify(modules),
        now(),
        staffId,
        null,
        newToken(),
      );
    database
      .prepare("DELETE FROM campaign_recipients WHERE campaign=?")
      .run(id);
    for (const s of subscribers)
      database
        .prepare(
          "INSERT INTO campaign_recipients(campaign,subscriber,email,first_name,last_name,language) VALUES (?,?,?,?,?,?)",
        )
        .run(
          id,
          s.id,
          s.email,
          s.first_name,
          s.last_name,
          s.language === "en" ? "en" : "sq",
        );
    database.exec("COMMIT");
    return { id };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
function render(
  c: Campaign,
  lang: Lang,
  links: Record<string, string> = {},
  unsubscribe = "",
  test = false,
) {
  const t = dictionary(lang),
    modules = JSON.parse(c.modules) as RecordData[];
  const subject = c[`subject_${lang}`] || c.subject_sq;
  const intro = c[`intro_${lang}`] || c.intro_sq;
  const cards = modules
    .map((m) => {
      const title = localized(m, "title", lang) || localized(m, "title", "sq"),
        description = (
          localized(m, "description", lang) || localized(m, "description", "sq")
        ).slice(0, 350);
      const link =
        links[m.id] ||
        `${origin()}/${lang}/modules/${encodeURIComponent(m.id)}`;
      return `<tr><td style="padding:20px 24px;border-bottom:1px solid #dce6ec">${m.thumbnail ? `<img alt="${escape(title)}" src="${escape(origin())}/api/media/${escape(m.thumbnail)}" width="552" style="width:100%;max-width:552px;height:auto;display:block;border-radius:8px">` : ""}<h2 style="font-size:23px;color:#023061">${escape(title)}</h2><p style="line-height:1.6;color:#39566c">${escape(description)}</p><a href="${escape(link)}" style="display:inline-block;padding:12px 20px;background:#023061;color:#fff;text-decoration:none;border-radius:6px">${escape(t.openResource)}</a></td></tr>`;
    })
    .join("");
  const html = `<!doctype html><html lang="${lang}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${escape(subject)}</title></head><body style="margin:0;background:#edf5f5;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="600" style="width:100%;max-width:600px;background:#fefefe;border-collapse:collapse"><tr><td style="padding:28px 24px;background:#023061;color:#fff"><strong>Galenus Med Academy</strong><h1 style="font-size:26px">${test ? "[TEST] " : ""}${escape(subject)}</h1><p style="line-height:1.6;white-space:pre-line">${escape(intro)}</p></td></tr>${cards}<tr><td style="padding:24px;font-size:13px;line-height:1.6;color:#39566c">${escape(t.newsletterFooter)}<br><a href="${escape(unsubscribe || `${origin()}/${lang}/unsubscribe`)}">${escape(t.unsubscribe)}</a></td></tr></table></td></tr></table></body></html>`;
  const text = `${subject}\n\n${intro}\n\n${modules.map((m) => `${localized(m, "title", lang) || localized(m, "title", "sq")}\n${links[m.id] || `${origin()}/${lang}/modules/${m.id}`}`).join("\n\n")}\n\n${t.unsubscribe}: ${unsubscribe || `${origin()}/${lang}/unsubscribe`}`;
  return { subject, html, text };
}
export function campaignDetail(id: string) {
  // A process interrupted after claiming a delivery cannot safely assume it was not sent.
  db()
    .prepare(
      "UPDATE campaign_recipients SET status='uncertain',error='interrupted' WHERE status='sending' AND attempted_at<?",
    )
    .run(Date.now() - 300000);
  const c = getCampaign(id);
  const recipients = (
    db()
      .prepare(
        "SELECT * FROM campaign_recipients WHERE campaign=? ORDER BY rowid",
      )
      .all(id) as Recipient[]
  ).map((r) => ({
    ...r,
    email: decryptEmail(r.email),
    first_name: decryptEmail(r.first_name),
    last_name: decryptEmail(r.last_name),
  }));
  const tests = (
    db()
      .prepare(
        "SELECT * FROM campaign_tests WHERE campaign=? ORDER BY created_at DESC",
      )
      .all(id) as { email: string }[]
  ).map((r) => ({ ...r, email: decryptEmail(r.email) }));
  return {
    ...c,
    modules: JSON.parse(c.modules),
    recipients,
    tests,
    previews: { sq: render(c, "sq"), en: render(c, "en") },
  };
}
export function listCampaigns() {
  return db()
    .prepare(
      "SELECT id,name,created_at,started_at FROM campaigns ORDER BY created_at DESC",
    )
    .all();
}
function failure(error: unknown) {
  const e = error as { code?: string; command?: string; responseCode?: number };
  const definite =
    (e.responseCode || 0) >= 400 ||
    ["CONN", "EHLO", "HELO", "AUTH", "MAIL FROM", "RCPT TO"].includes(
      e.command || "",
    ) ||
    e.code === "EAUTH" ||
    e.code === "EDNS";
  return {
    status: definite ? "failed" : "uncertain",
    error: [e.code || "SMTP_ERROR", e.responseCode || "", e.command || ""]
      .join(" ")
      .trim(),
  };
}
export async function sendCampaign(id: string, raw: unknown) {
  const input = z
      .object({
        confirm: z.literal(true),
        revision: z.string(),
        retry: z.boolean().default(false),
      })
      .parse(raw),
    c = getCampaign(id);
  if (c.revision !== input.revision)
    throw new NewsletterError("previewChanged", 409);
  const transport = mailTransport();
  try {
    await transport.verify();
  } catch {
    transport.close();
    throw new NewsletterError("smtpFailed", 503);
  }
  const database = db();
  const frozen = database
    .prepare(
      "UPDATE campaigns SET started_at=COALESCE(started_at,?) WHERE id=? AND revision=?",
    )
    .run(now(), id, input.revision);
  if (!frozen.changes) {
    transport.close();
    throw new NewsletterError("previewChanged", 409);
  }
  const candidates = database
    .prepare(
      `SELECT * FROM campaign_recipients WHERE campaign=? AND (status='pending' ${input.retry ? "OR status='failed'" : ""}) ORDER BY rowid LIMIT 20`,
    )
    .all(id) as Recipient[];
  try {
    for (const r of candidates) {
      const claimed = database
        .prepare(
          "UPDATE campaign_recipients SET status='sending',attempts=attempts+1,attempted_at=? WHERE campaign=? AND subscriber=? AND status=?",
        )
        .run(Date.now(), id, r.subscriber, r.status);
      if (!claimed.changes) continue;
      const subscriber = database
        .prepare("SELECT * FROM newsletter_subscribers WHERE id=?")
        .get(r.subscriber) as Subscriber;
      if (subscriber.status !== "active") {
        database
          .prepare(
            "UPDATE campaign_recipients SET status='skipped',error='unsubscribed' WHERE campaign=? AND subscriber=?",
          )
          .run(id, r.subscriber);
        continue;
      }
      const lang = r.language === "en" ? "en" : "sq",
        links: Record<string, string> = {};
      for (const module of JSON.parse(c.modules) as RecordData[]) {
        const token = newToken();
        database
          .prepare("INSERT INTO newsletter_links VALUES (?,?,?,?,?)")
          .run(
            hash(token),
            r.subscriber,
            module.id,
            lang,
            Date.now() + 30 * 86400000,
          );
        links[module.id] = `${origin()}/api/access/${token}`;
      }
      const unsub = `${origin()}/${lang}/unsubscribe?token=${decryptEmail(subscriber.unsubscribe_token)}`;
      const composed = render(c, lang, links, unsub),
        messageId = `<${id}.${r.subscriber}@${new URL(origin()).hostname}>`;
      try {
        const result = await transport.sendMail({
          from: {
            name: "Galenus Med Academy",
            address: process.env.SMTP_FROM!,
          },
          to: decryptEmail(r.email),
          ...composed,
          messageId,
          headers: { "List-Unsubscribe": `<${unsub}>` },
        });
        if (!result.accepted?.length) {
          database
            .prepare(
              "UPDATE campaign_recipients SET status='failed',error='recipient_rejected',message_id=? WHERE campaign=? AND subscriber=?",
            )
            .run(messageId, id, r.subscriber);
        } else
          database
            .prepare(
              "UPDATE campaign_recipients SET status='accepted',sent_at=?,message_id=?,error=NULL WHERE campaign=? AND subscriber=?",
            )
            .run(now(), messageId, id, r.subscriber);
      } catch (error) {
        const result = failure(error);
        database
          .prepare(
            "UPDATE campaign_recipients SET status=?,error=?,message_id=? WHERE campaign=? AND subscriber=?",
          )
          .run(result.status, result.error, messageId, id, r.subscriber);
      }
    }
  } finally {
    transport.close();
  }
  return campaignDetail(id);
}
export async function testCampaign(id: string, raw: unknown) {
  const input = z
    .object({
      email: z.string().email().max(254),
      language: z.enum(["sq", "en"]),
    })
    .parse(raw);
  if (!limit("campaign-tests", 30)) throw new NewsletterError("rateLimit", 429);
  const c = getCampaign(id),
    transport = mailTransport(),
    testId = randomUUID();
  // Test messages contain public module links, never grant private access or subscribe the test address.
  const composed = render(c, input.language, {}, "", true);
  try {
    const result = await transport.sendMail({
      from: { name: "Galenus Med Academy", address: process.env.SMTP_FROM! },
      to: input.email,
      ...composed,
      subject: `[TEST] ${composed.subject}`,
    });
    if (!result.accepted?.length) throw { responseCode: 550 };
    db()
      .prepare("INSERT INTO campaign_tests VALUES (?,?,?,?,?,?,?)")
      .run(
        testId,
        id,
        encryptEmail(input.email),
        input.language,
        "accepted",
        now(),
        null,
      );
    return { ok: true };
  } catch (error) {
    const result = failure(error);
    db()
      .prepare("INSERT INTO campaign_tests VALUES (?,?,?,?,?,?,?)")
      .run(
        testId,
        id,
        encryptEmail(input.email),
        input.language,
        result.status,
        now(),
        result.error,
      );
    throw new NewsletterError("smtpFailed", 502);
  } finally {
    transport.close();
  }
}
