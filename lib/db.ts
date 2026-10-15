import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { migrateModules } from "./migrations";
import { initializeNewsletter } from "./newsletter-schema";
import { copy, RecordData, Lang, Copy } from "./content";
export const dataDir = path.resolve(process.env.DATA_DIR || "./data");
let connection: DatabaseSync;
export function db() {
  if (connection) return connection;
  mkdirSync(path.join(dataDir, "media"), { recursive: true });
  connection = new DatabaseSync(path.join(dataDir, "academy.sqlite"));
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')));
 CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, private INTEGER NOT NULL, size INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, module TEXT NOT NULL, email TEXT NOT NULL, email_hash TEXT NOT NULL, registered_at TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', UNIQUE(module,email_hash));
 CREATE TABLE IF NOT EXISTS grants (token TEXT PRIMARY KEY, module TEXT NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);`);
  if (
    !connection.prepare("SELECT id FROM records WHERE id=?").get("settings")
  ) {
    const seed: { id: string; kind: string; [key: string]: unknown }[] = [
      {
        id: "settings",
        kind: "settings",
        siteName: "Galenus Med Academy",
        contactEmail: "",
        navigation: ["home", "about", "gallery", "modules"],
      },
      { id: "copy-sq", kind: "pages", ...copy.sq },
      { id: "copy-en", kind: "pages", ...copy.en },
      ...["Dr. Jakup Vrioni", "Dr. Erion Shehu"].map((name, i) => ({
        id: `doctor-${i + 1}`,
        kind: "doctors",
        name,
        published: true,
      })),
      {
        id: "module-placeholder",
        kind: "modules",
        title_sq: "Modul i ardhshëm",
        title_en: "Upcoming module",
        description_sq:
          "Vendmbajtës për një modul të akademisë. Tema, lektori dhe data do të konfirmohen.",
        description_en:
          "Placeholder for an academy module. Topic, lecturer, and date will be confirmed.",
        published: true,
        featured: true,
        placeholder: true,
      },
    ];
    const insert = connection.prepare(
      "INSERT OR IGNORE INTO records VALUES (?,?,?)",
    );
    for (const r of seed) insert.run(r.id, r.kind, JSON.stringify(r));
  }
  migrateModules(connection, dataDir);
  initializeNewsletter(connection);
  return connection;
}
export function records(kind: string): RecordData[] {
  return (
    db()
      .prepare("SELECT data FROM records WHERE kind=? ORDER BY rowid")
      .all(kind) as { data: string }[]
  ).map((r) => JSON.parse(r.data));
}
export function record(id: string): RecordData | undefined {
  const r = db().prepare("SELECT data FROM records WHERE id=?").get(id) as
    { data: string } | undefined;
  return r ? JSON.parse(r.data) : undefined;
}
export function saveRecord(r: {
  id: string;
  kind: string;
  [key: string]: unknown;
}) {
  db()
    .prepare(
      "INSERT INTO records VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    )
    .run(r.id, r.kind, JSON.stringify(r));
}
export function dictionary(lang: Lang): Copy {
  return { ...copy[lang], ...record(`copy-${lang}`) } as Copy;
}
export function publicRecords(kind: string) {
  return records(kind)
    .filter((r) => r.published)
    .map(
      ({ fullMedia, previewMedia, resources, ...r }) =>
        ({
          ...r,
          resources: Array.isArray(resources)
            ? resources
                .filter((item) => item.published)
                .map(({ media, ...item }) => item)
            : [],
        }) as RecordData,
    );
}
