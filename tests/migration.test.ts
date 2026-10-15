import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { migrateModules } from "../lib/migrations";
test("legacy migration backs up and preserves users, media, enrollments and grants; removes policy dependencies once", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "galenus-migration-"));
  const database = new DatabaseSync(path.join(directory, "academy.sqlite"));
  try {
    database.exec(`CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,data TEXT);
 CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT); INSERT INTO users VALUES ('account','Keep me');
 CREATE TABLE media(id TEXT PRIMARY KEY,name TEXT); INSERT INTO media VALUES ('asset','Keep.mp4');
 CREATE TABLE subscriptions(id TEXT PRIMARY KEY,webinar TEXT,email TEXT,email_hash TEXT,consent_at TEXT,policy TEXT,UNIQUE(webinar,email_hash));
 INSERT INTO subscriptions VALUES ('enrollment','original-id','ciphertext','hash','2026-01-01','obsolete');
 CREATE TABLE grants(token TEXT PRIMARY KEY,webinar TEXT,expires INTEGER); INSERT INTO grants VALUES ('token','original-id',9999999999999);`);
    for (const record of [
      {
        id: "settings",
        kind: "settings",
        siteName: "Keep",
        contactEmail: "legacy@example.test",
        privacyPublished: true,
        navigation: ["home", "webinars", "privacy"],
      },
      {
        id: "original-id",
        kind: "webinars",
        title_en: "Existing title",
        fullMedia: "asset",
        previewMedia: "old-preview",
        published: true,
      },
      { id: "privacy-policy", kind: "privacy", body_en: "Old policy" },
      {
        id: "copy-en",
        kind: "pages",
        hero: "Keep custom copy",
        webinars: "Webinars",
        privacyText: "Old policy",
        consent: "Old consent",
      },
    ])
      database
        .prepare("INSERT INTO records VALUES (?,?,?)")
        .run(record.id, record.kind, JSON.stringify(record));
    migrateModules(database, directory);
    const record = (id: string) => {
      const row = database
        .prepare("SELECT data FROM records WHERE id=?")
        .get(id) as { data: string } | undefined;
      return row ? JSON.parse(row.data) : undefined;
    };
    assert.equal(record("original-id").kind, "modules");
    assert.equal(record("original-id").fullMedia, "asset");
    assert.equal(record("original-id").previewMedia, undefined);
    assert.equal(record("original-id").title_en, "Existing title");
    assert.equal(record("privacy-policy"), undefined);
    assert.equal(record("copy-en").hero, "Keep custom copy");
    assert.equal(record("copy-en").modules, "Modules");
    assert.equal(record("copy-en").privacyText, undefined);
    assert.deepEqual(record("settings").navigation, ["home", "modules"]);
    assert.equal(record("contact-details").email, "legacy@example.test");
    const subscription = database.prepare("SELECT * FROM subscriptions").get()!;
    assert.equal(subscription.module, "original-id");
    assert.equal(subscription.email, "ciphertext");
    assert.equal(subscription.first_name, "");
    assert.equal(subscription.policy, undefined);
    assert.equal(
      database.prepare("SELECT module FROM grants").get()!.module,
      "original-id",
    );
    assert.equal(
      database.prepare("SELECT name FROM users").get()!.name,
      "Keep me",
    );
    assert.equal(
      database.prepare("SELECT name FROM media").get()!.name,
      "Keep.mp4",
    );
    const backups = readdirSync(path.join(directory, "backups"));
    assert.equal(backups.length, 1);
    const backup = new DatabaseSync(
      path.join(directory, "backups", backups[0]),
      { readOnly: true },
    );
    assert.ok(backup.prepare("SELECT policy FROM subscriptions").get());
    backup.close();
    database.prepare("DELETE FROM records WHERE id='contact-details'").run();
    migrateModules(database, directory);
    assert.equal(record("contact-details"), undefined);
    assert.equal(readdirSync(path.join(directory, "backups")).length, 1);
  } finally {
    database.close();
    if (
      path.dirname(directory) === path.resolve(tmpdir()) &&
      path.basename(directory).startsWith("galenus-migration-")
    )
      rmSync(directory, { recursive: true, force: true });
  }
});
