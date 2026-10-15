import { DatabaseSync } from "node:sqlite";
import { copy } from "./content";
export function initializeNewsletter(database: DatabaseSync) {
  // Additive migration: historical module enrollments and grants remain intact.
  database.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, email_hash TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL, last_name TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'sq',
      status TEXT NOT NULL CHECK(status IN ('active','unsubscribed')), consent_at TEXT NOT NULL,
      consent_text TEXT NOT NULL, unsubscribed_at TEXT, unsubscribe_token TEXT NOT NULL, unsubscribe_hash TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, subject_sq TEXT NOT NULL, subject_en TEXT NOT NULL,
      intro_sq TEXT NOT NULL, intro_en TEXT NOT NULL, modules TEXT NOT NULL,
      created_at TEXT NOT NULL, created_by TEXT NOT NULL, started_at TEXT, revision TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaign_recipients (
      campaign TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      subscriber TEXT NOT NULL REFERENCES newsletter_subscribers(id), email TEXT NOT NULL,
      first_name TEXT NOT NULL, last_name TEXT NOT NULL, language TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT, sent_at TEXT, attempted_at INTEGER, message_id TEXT,
      PRIMARY KEY(campaign,subscriber)
    );
    CREATE TABLE IF NOT EXISTS newsletter_links (
      token TEXT PRIMARY KEY, subscriber TEXT NOT NULL REFERENCES newsletter_subscribers(id),
      module TEXT NOT NULL, language TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaign_tests (
      id TEXT PRIMARY KEY, campaign TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      email TEXT NOT NULL, language TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, error TEXT
    );
  `);
  if (
    database
      .prepare("SELECT id FROM records WHERE id='newsletter-copy-v1'")
      .get()
  )
    return;
  const previous = {
    sq: {
      uploadHelp: "JPEG, PNG, WebP, MP4 ose WebM. Maksimumi 100 MB.",
      unsupportedMedia:
        "Formati nuk mbështetet. Përdorni JPEG, PNG, WebP, MP4 ose WebM.",
      invalidMedia:
        "Skedari është i dëmtuar ose nuk përmban foto/video të vlefshme.",
      privateHelp: "Videot e plota duhet të ngarkohen si private.",
    },
    en: {
      uploadHelp: "JPEG, PNG, WebP, MP4 or WebM. Maximum 100 MB.",
      unsupportedMedia: "Unsupported format. Use JPEG, PNG, WebP, MP4 or WebM.",
      invalidMedia:
        "The file is damaged or does not contain a valid image/video.",
      privateHelp: "Full videos must be uploaded as private.",
    },
  };
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const lang of ["sq", "en"] as const) {
      const row = database
        .prepare("SELECT data FROM records WHERE id=?")
        .get(`copy-${lang}`) as { data: string } | undefined;
      if (!row) continue;
      const value = JSON.parse(row.data);
      for (const key of Object.keys(
        previous[lang],
      ) as (keyof typeof previous.en)[])
        if (value[key] === previous[lang][key]) value[key] = copy[lang][key];
      database
        .prepare("UPDATE records SET data=? WHERE id=?")
        .run(JSON.stringify(value), `copy-${lang}`);
    }
    database
      .prepare("INSERT INTO records VALUES ('newsletter-copy-v1','internal',?)")
      .run(JSON.stringify({ id: "newsletter-copy-v1", kind: "internal" }));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
