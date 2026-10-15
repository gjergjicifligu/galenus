import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
export type Staff = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
};
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, encoded: string) {
  const [salt, key] = encoded.split(":");
  const expected = Buffer.from(key, "hex");
  return timingSafeEqual(scryptSync(password, salt, 64), expected);
}
export async function staff(): Promise<Staff | undefined> {
  const token = (await cookies()).get("gma_session")?.value;
  if (!token) return;
  const user = db()
    .prepare(
      "SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
    )
    .get(hash(token), Date.now()) as Staff | undefined;
  return user ? { ...user } : undefined;
}
export const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};
export function allowed(role: string, kind: string) {
  return (
    role === "admin" ||
    (role === "user" && ["gallery", "modules", "media"].includes(kind))
  );
}
export function requireOrigin(req: Request) {
  const expected = process.env.APP_ORIGIN || "http://localhost:3000";
  const supplied = req.headers.get("origin");
  if (supplied === expected) return;
  try {
    const target = new URL(expected),
      origin = new URL(supplied || "");
    const loopback = (host: string) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(host);
    if (
      target.protocol === "http:" &&
      origin.protocol === target.protocol &&
      origin.port === target.port &&
      loopback(target.hostname) &&
      loopback(origin.hostname) &&
      origin.origin === supplied
    )
      return;
  } catch {
    /* Malformed origins remain denied. */
  }
  throw new Error("origin");
}
export function limit(key: string, max = 10) {
  const now = Date.now();
  db().prepare("DELETE FROM limits WHERE until<?").run(now);
  const row = db().prepare("SELECT count FROM limits WHERE key=?").get(key) as
    { count: number } | undefined;
  if (row && row.count >= max) return false;
  db()
    .prepare(
      "INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    )
    .run(key, now + 900000);
  return true;
}
function encryptionKey() {
  const key = process.env.SUBSCRIPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error("Subscription encryption is not configured");
  return Buffer.from(key, "hex");
}
export function emailHash(email: string) {
  return createHmac("sha256", encryptionKey()).update(email).digest("hex");
}
export function encryptEmail(email: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const payload = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    payload.toString("hex"),
  ].join(":");
}
export function decryptEmail(value: string) {
  const [iv, tag, payload] = value.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload, "hex")),
    decipher.final(),
  ]).toString();
}
export function newToken() {
  return randomBytes(32).toString("hex");
}
