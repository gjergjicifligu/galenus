import { NextRequest, NextResponse } from "next/server";
import { db, record } from "./db";
import { cookieOptions, hash, newToken, Staff } from "./security";
import {
  campaignDetail,
  listCampaigns,
  listSubscribers,
  saveCampaign,
  sendCampaign,
  smtpConfigured,
  subscribeNewsletter,
  testCampaign,
  unsubscribeNewsletter,
  NewsletterError,
} from "./newsletter";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function input(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new NewsletterError("invalid");
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 250000) {
      await reader.cancel();
      throw new NewsletterError("invalid", 413);
    }
    chunks.push(Buffer.from(value));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new NewsletterError("invalid");
  }
}
export async function newsletterAPI(
  req: NextRequest,
  parts: string[],
  current?: Staff,
) {
  const [section, id, action] = parts;
  if (!["newsletter", "campaigns", "access"].includes(section)) return;
  if (Number(req.headers.get("content-length") || 0) > 250000)
    throw new NewsletterError("invalid", 413);
  if (section === "access") {
    if (req.method !== "GET") return json({ error: "invalid" }, 405);
    if (!/^[a-f0-9]{64}$/.test(id || ""))
      throw new NewsletterError("invalidLink", 404);
    const link = db()
      .prepare(
        "SELECT l.* FROM newsletter_links l JOIN newsletter_subscribers s ON s.id=l.subscriber WHERE l.token=? AND l.expires>? AND s.status='active'",
      )
      .get(hash(id), Date.now()) as
      { module: string; language: string } | undefined;
    if (!link || !record(link.module)?.published)
      throw new NewsletterError("invalidLink", 404);
    const token = newToken();
    db().prepare("DELETE FROM grants WHERE expires<?").run(Date.now());
    db()
      .prepare("INSERT INTO grants VALUES (?,?,?)")
      .run(hash(token), link.module, Date.now() + 86400000);
    const response = NextResponse.redirect(
      new URL(
        `/${link.language}/modules/${encodeURIComponent(link.module)}`,
        process.env.APP_ORIGIN || "http://localhost:3000",
      ),
    );
    response.cookies.set(`gma_module_${link.module}`, token, {
      ...cookieOptions,
      maxAge: 86400,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  if (section === "newsletter" && id === "subscribe" && req.method === "POST")
    return json(subscribeNewsletter(await input(req)));
  if (
    section === "newsletter" &&
    id === "unsubscribe" &&
    req.method === "POST"
  ) {
    const body = await input(req);
    return json(unsubscribeNewsletter(String(body?.token || "")));
  }
  if (!current) return json({ error: "accessDenied" }, 401);
  if (current.role !== "admin") return json({ error: "accessDenied" }, 403);
  if (section === "newsletter" && id === "subscribers" && req.method === "GET")
    return json(listSubscribers());
  if (section === "campaigns") {
    if (req.method === "GET")
      return json(
        id
          ? campaignDetail(id)
          : { campaigns: listCampaigns(), smtpConfigured: smtpConfigured() },
      );
    if (req.method === "POST") {
      if (!id) return json(saveCampaign(await input(req), current.id));
      if (action === "send")
        return json(await sendCampaign(id, await input(req)));
      if (action === "test")
        return json(await testCampaign(id, await input(req)));
    }
  }
  return json({ error: "invalid" }, 404);
}
