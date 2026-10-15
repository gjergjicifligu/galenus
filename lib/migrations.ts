import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { copy } from "./content";
export const legacyGrantCookie = (id: string) => `gma_webinar_${id}`;

// Legacy names deliberately remain here only, so existing installations migrate safely.
export function migrateModules(database: DatabaseSync, directory: string) {
  if (database.prepare("SELECT id FROM records WHERE id='modules-v3'").get())
    return;
  const columns = database
    .prepare("PRAGMA table_info(subscriptions)")
    .all() as { name: string }[];
  const legacy = columns.some((c) => c.name === "webinar");
  if (legacy) {
    mkdirSync(path.join(directory, "backups"), { recursive: true });
    database
      .prepare("VACUUM INTO ?")
      .run(path.join(directory, "backups", `pre-modules-${Date.now()}.sqlite`));
  }
  database.exec("BEGIN IMMEDIATE");
  try {
    if (legacy)
      database.exec(`
      ALTER TABLE subscriptions RENAME TO subscriptions_legacy;
      CREATE TABLE subscriptions (id TEXT PRIMARY KEY, module TEXT NOT NULL, email TEXT NOT NULL, email_hash TEXT NOT NULL, registered_at TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', UNIQUE(module,email_hash));
      INSERT INTO subscriptions(id,module,email,email_hash,registered_at) SELECT id,webinar,email,email_hash,consent_at FROM subscriptions_legacy;
      DROP TABLE subscriptions_legacy;
      ALTER TABLE grants RENAME COLUMN webinar TO module;
    `);
    const rows = database.prepare("SELECT id,kind,data FROM records").all() as {
      id: string;
      kind: string;
      data: string;
    }[];
    for (const row of rows) {
      if (row.kind === "privacy") {
        database.prepare("DELETE FROM records WHERE id=?").run(row.id);
        continue;
      }
      const value = JSON.parse(row.data);
      if (row.kind === "settings") {
        if (
          value.contactEmail &&
          !database
            .prepare("SELECT id FROM records WHERE kind='contacts'")
            .get()
        ) {
          database.prepare("INSERT INTO records VALUES (?,?,?)").run(
            "contact-details",
            "contacts",
            JSON.stringify({
              id: "contact-details",
              kind: "contacts",
              email: value.contactEmail,
              published: true,
            }),
          );
        }
        delete value.contactEmail;
        if (Array.isArray(value.navigation))
          value.navigation = value.navigation
            .filter((n: string) => n !== "privacy")
            .map((n: string) => (n === "webinars" ? "modules" : n));
      }
      for (const key of Object.keys(value))
        if (/privacy|policyHelp|consent|previewMedia/.test(key))
          delete value[key];
      if (row.kind === "webinars") {
        value.kind = "modules";
        if (value.placeholder)
          for (const key of [
            "title_sq",
            "title_en",
            "description_sq",
            "description_en",
          ])
            if (typeof value[key] === "string")
              value[key] = value[key]
                .replace(/Webinar/g, key.endsWith("_sq") ? "Modul" : "Module")
                .replace(/webinar/g, key.endsWith("_sq") ? "modul" : "module");
      }
      if (row.kind === "pages") {
        const defaults = copy[row.id === "copy-sq" ? "sq" : "en"];
        for (const [key, text] of Object.entries(value)) {
          if (typeof text !== "string") continue;
          const newKey = key
            .replace(/Webinars/g, "Modules")
            .replace(/webinars/g, "modules");
          value[newKey] = text
            .replace(/Webinaret/g, "Modulet")
            .replace(/webinaret/g, "modulet")
            .replace(/webinarin/g, "modulin")
            .replace(/Webinars/g, "Modules")
            .replace(/webinars/g, "modules")
            .replace(/Webinar/g, "Module")
            .replace(/webinar/g, "module");
          if (newKey !== key) delete value[key];
        }
        for (const key of [
          "libraryText",
          "full",
          "subscribe",
          "success",
          "invalid",
          "preview",
          "unavailable",
        ] as const)
          value[key] = defaults[key];
        delete value.body;
      }
      database
        .prepare("UPDATE records SET kind=?,data=? WHERE id=?")
        .run(value.kind, JSON.stringify(value), row.id);
    }
    database
      .prepare("INSERT INTO records VALUES ('modules-v3','internal',?)")
      .run(JSON.stringify({ id: "modules-v3", kind: "internal" }));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
