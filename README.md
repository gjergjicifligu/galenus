# Galenus Med Academy

A complete bilingual academy website with a staff CMS, built in the initially empty workspace using **Next.js 15 App Router, React 19, TypeScript, and Node.js 24's SQLite**. This keeps rendering, authorization, and persistence in one deployable application without an external database service.

## Run locally

1. Install Node.js **24.x**.
2. Run `npm install` (use `npm.cmd` in PowerShell if script execution is restricted).
3. Copy `.env.example` to `.env.local`.
4. Generate a key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the output in `SUBSCRIPTION_KEY`. Keep this key secret and stable: changing it prevents existing subscriber names and emails from being decrypted.
5. Set `APP_ORIGIN` to the browser origin, initially `http://localhost:3000`. Set `DATA_DIR` to a durable writable directory, initially `./data`.
6. Run `npm run dev`, then open **http://localhost:3000**. Albanian is the default; English is at `/en`. Language stays in every public navigation URL.

### Create the first administrator

There are no default accounts or built-in passwords. In PowerShell, set `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` in the process environment, then run:

```powershell
# Enter values privately; do not commit credentials.
$env:ADMIN_EMAIL = Read-Host 'Admin email'
$env:ADMIN_NAME = Read-Host 'Admin name'
$secret = Read-Host 'Admin password (12+ characters)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
node --env-file=.env.local --import tsx scripts/create-admin.ts
Remove-Item Env:ADMIN_PASSWORD
```

Visit `/sq/manage` or `/en/manage`. Admins can create other accounts, reset passwords, and change roles in **Users**. Account changes invalidate that account's sessions. A signed-in admin cannot delete or demote their own account. Forgotten passwords can be reset by another administrator; if none exists, create an additional admin through this local CLI with a different email.

## Features and content

- Albanian and English Home, About, Gallery, Modules and individual module pages, with localized SEO and a persistent language switcher.
- Sticky translucent navigation and the supplied academy logo traced into SVG. The original and reproducible vectorization script are retained in `public/logo-source.png` and `scripts/vectorize-logo.cjs`.
- Admins manage bilingual page copy, doctor profiles, contact details, gallery, modules, media, subscriptions, users and navigation. Regular users can manage only Gallery, Modules and the shared Media library. Permissions are enforced by the API.
- Doctors, contacts, gallery and modules have Add, View, Edit, Publish/Unpublish and Delete controls. All content is stored in SQLite and published changes appear on public pages without code edits.
- Modules have bilingual titles and multi-paragraph descriptions, one public preview image and optional lecturer details, dates, featured status and private resources. Detail pages contain no registration form.
- Home and the Modules overview share a **general module newsletter** form with first name, last name, email and required educational-email consent. The page language is saved as the subscriber's preference. `/modules` redirects to `/sq/modules`; the forms are at `/sq/modules#register` and `/en/modules#register`. The header Register button links there; Contact is part of the regular navigation.
- Newsletter subscribers are separate from historical module enrollments. Names/emails are encrypted with AES-256-GCM, and a unique HMAC email fingerprint prevents duplicate subscriptions. Re-submission updates the existing subscriber and records renewed consent. Existing module enrollees are **not automatically opted in**. Their records remain in **Previous module enrollments**, and existing grants still work.
- The privacy-policy feature remains removed. The opt-in checkbox records the actual bilingual consent text and its timestamp without a separate policy page.
- Emails contain module-specific random access links, valid for 30 days. A valid link exchanges for a 24-hour HttpOnly module access cookie. The server validates publication and grants on every private resource request, including byte ranges. Public page data omits private file identifiers. Links act as bearer credentials: someone receiving a forwarded link can use it until expiry. This is not a paid-content DRM system.

### Media library

Use the file picker or drag files into the upload area, choose Public/Private, and select **Upload media**. Multiple files are supported, with per-file success/error messages. The library shows image thumbnails, playable video previews and filenames. Admin content forms offer filtered selectors and a preview of the selected asset.

Supported formats: JPEG, PNG, WebP, MP4 and WebM up to 100 MiB, plus PDF up to 20 MiB. The server bounds request bodies, detects signatures, decodes images with Sharp (maximum 40 million pixels), inspects video streams with bundled ffprobe, and parses PDFs with pdf-lib. Encrypted PDFs, scripts, interactive actions/forms, embedded files and invalid documents are rejected. Browser playback depends on codec support; use H.264 MP4 or VP8/VP9 WebM for broad compatibility. No separate ffmpeg service is required.

In a module editor, **Module materials** supports private uploads and association of up to 50 image/video/PDF resources. Each resource has bilingual titles/descriptions, an applicable language, order and publication status. An Albanian title is required as the fallback. Previews are available to authorized staff. Uploads made directly in this area are automatically private. Save the module after associating or changing resources. The library also accepts PDFs and provides an rendered first-page PDF preview and a download link.

All module resources must be **Private**. Module cover images, doctor photos and gallery assets must be **Public**. Gallery content remains image/video only. Public files are accessible by URL even if used by a draft. Files are immutable; upload/select replacements. Referenced resources cannot be deleted until removed from their module. Private resource endpoints check both the module and resource publication status; staff can preview drafts through the authenticated media library.

### Newsletter campaigns and SMTP

Only admins can open **Newsletter / Email campaigns**. Create a campaign, enter its name, Albanian subject (required), optional English subject, and bilingual introductions. Select published modules and active subscribers. Individual checkboxes and **Select all in the filtered list** are available for both lists; selections outside the current filter are retained. Unsubscribed addresses cannot be selected.

Save to freeze a preview of the selected module titles, descriptions and cover images. Review both email languages, optionally send a test to a specified address, then tick the final confirmation and choose **Send campaign**. Missing English content falls back to Albanian. Real campaign emails contain secure content links, never video attachments or raw private PDF/video URLs. PDFs use secure links rather than attachments. Test emails contain public module links and do not grant access or create a subscriber.

Set these **server-side** variables in `.env.local` (safe blanks are in `.env.example`), then restart the server:

| Variable                      | Required configuration                                                          |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `SMTP_HOST`                   | Your SMTP provider's host                                                       |
| `SMTP_PORT`                   | Usually 587 for STARTTLS or 465 for implicit TLS                                |
| `SMTP_SECURE`                 | `false` for mandatory STARTTLS; `true` for implicit TLS                         |
| `SMTP_USER` / `SMTP_PASSWORD` | Provider-issued credentials; omit only for a deliberately unauthenticated relay |
| `SMTP_FROM`                   | One verified sender email address; the app supplies the academy display name    |
| `APP_ORIGIN`                  | Public HTTPS origin for usable email images, access links and unsubscribe links |
| `SMTP_ALLOW_INSECURE_LOCAL`   | Keep `false`; `true` is accepted only for loopback test servers                 |

Use your provider's sender verification and DNS setup. The application never disables certificate verification for remote SMTP. If SMTP is missing or verification fails, sending returns an error and recipients remain pending; no successful send is claimed. No email provider is bundled or implicitly configured.

Campaign module snapshots, selected recipients, language, timestamps, attempts, message IDs, test-email results and per-recipient states persist in SQLite. A campaign becomes immutable when sending starts. Requests process at most 20 recipients; the dashboard continues pending batches while open. Closing it leaves later batches pending: reopen the saved campaign, preview, confirm and continue. Configure the production proxy timeout to allow a batch, or reduce its size for a slower provider. Campaigns currently support up to 500 selected recipients and 50 modules.

**Accepted by SMTP** means the provider accepted the message, not that inbox delivery was confirmed. This SMTP integration has no bounce/webhook tracking. Pending recipients are sent once; confirmed failures can be explicitly retried. Accepted/skipped recipients are not resent. A timeout after DATA or an interrupted process may have delivered a message: those records remain **Uncertain** and are deliberately not automatically retried. Check the provider's logs before deciding whether to create a replacement campaign. Recipient claims are atomic, so concurrent sends and restarts do not reset accepted rows. SMTP cannot guarantee exactly-once delivery across an ambiguous network failure.

Each real newsletter has an unsubscribe link. Visiting it shows a localized confirmation page; confirming marks the subscriber inactive. This avoids automatic unsubscribe by email link scanners. The action is idempotent, and both selection and sending recheck active status. Already in-flight mail cannot be recalled. Unsubscribing blocks future campaigns and new email-link access; existing short-lived module grants retain their original expiry. Re-subscription requires submitting the consent form again.

The newsletter migration only adds tables; it does not convert or remove old enrollments, accounts, media or modules. Keep the existing `SUBSCRIPTION_KEY` unchanged, as it also protects newsletter identities and stored unsubscribe tokens.

### Existing installations

The first request automatically runs the transactional migration in `lib/migrations.ts`. Before converting a legacy database, SQLite creates a consistent backup in `DATA_DIR/backups/pre-modules-<timestamp>.sqlite`. Keep backups restricted to the service account; they contain the previous private database state.

The migration preserves accounts, sessions, media files, content IDs, existing encrypted subscriber emails and video grants. It renames the stored collection and subscription/grant associations to Modules, removes obsolete preview references and policy records/columns, and updates navigation and interface labels. Existing custom titles/descriptions remain intact. Legacy links redirect to Modules, and unexpired legacy access cookies are accepted. Migration runs once; deleted records stay deleted. Original media files remain available in the library.

### Content locations

| Panel                  | Editable content                                                                                 | Public location                    |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| Doctors                | Name, photo, bilingual biography, specialty, qualifications, experience                          | Home and About                     |
| Contact details        | Email, phone, bilingual address and hours                                                        | Every public footer                |
| Gallery                | Images/videos, bilingual title/description/category, date                                        | Gallery                            |
| Modules                | Bilingual title/description, preview image, optional lecturer/date/private material, publication | Modules and featured Home cards    |
| Content & translations | Both language dictionaries                                                                       | Public interface and page sections |

Contact details have one site-wide record; deleting it enables Add record again. The dashboard remains at `/sq/manage` and `/en/manage`, with no public footer link.

## Production

```text
npm run build
npm start
```

Run on a **persistent Node.js 24 server** with a single application instance and a durable disk. Do not deploy this local SQLite/media configuration onto ephemeral serverless storage. Use HTTPS through a reverse proxy, set `APP_ORIGIN` to the public HTTPS origin, and set `COOKIE_SECURE=true`. Terminate oversized upload requests at the proxy (100 MB file limit, approximately 101 MB total request limit), configure request timeouts, and restrict the data directory to the service account. Use a host with disk encryption. Back up the SQLite database, media directory, and encryption key securely together; use SQLite's backup facilities or stop writes when taking a file backup. Never serve `DATA_DIR` as a public directory.

Passwords use salted scrypt hashes; session and viewing tokens are random and stored only as hashes. Session lifetime is 8 hours. Subscription names and emails use AES-256-GCM encryption and HMAC fingerprints for deduplication. All writes enforce the configured origin. For local HTTP development only, localhost, 127.0.0.1 and [::1] are accepted as aliases on the same port; other origins remain blocked. Login and registration use persistent rate limits (15-minute windows); tune the global quotas in `lib/security.ts` / the API route for expected traffic. Invalid requests and authorization failures return localized messages through the UI. No secrets are shipped to the browser.

## Checks

```text
npm run build
npm run typecheck
npm test
npm audit
```

The integration suites start isolated production servers on ports 3217 and 3218 with temporary databases and random credentials/keys. They test both languages, authentication, role restrictions, upload validation, protected resources, old grants, newsletter consent/deduplication/encryption, missing SMTP, real sends to a local SMTP fixture, delivery failures/retries, persistence and unsubscribe behavior. No real subscriber emails are sent. Run a production build before the suite.

Optional browser QA (Chromium):

```powershell
npx.cmd playwright install chromium
$env:BROWSER_QA = 'true'
npm.cmd test
Remove-Item Env:BROWSER_QA
```

This also checks desktop/tablet/mobile widths, language switching, staff login, role-specific navigation, and the subscription UI, and saves screenshots to `test-results/`. It performs create/view/edit/publish/unpublish/delete operations through the dashboard for all four content panels, checks both public languages, and reads saved records through an independent SQLite connection. Real generated MP4/WebM fixtures verify video uploads and browser playback. Browser checks also exercise drag-and-drop, invalid files, selected image previews and sticky navigation. Test media contains only geometric shapes.

## Project map

- `app/[lang]/[[...slug]]`: server-rendered public pages and metadata.
- `app/[lang]/manage`: staff login and dashboard.
- `app/api/[...path]`: authentication, authorization, CRUD, uploads, subscription, and streaming endpoints.
- `components/`: public design and staff forms.
- `lib/content.ts`: bilingual seed copy and data types.
- `lib/db.ts`: schema initialization and persistence.
- `lib/security.ts`: password, session, encryption, and rate-limit helpers.
- `tests/`: integration and optional browser checks.

## Information still needed

- Doctor biographies, specialties, qualifications, experience, and approved portraits for Dr. Jakup Vrioni and Dr. Erion Shehu.
- Actual module titles, descriptions, preview images, and any optional lecturer details, dates or private materials.
- Gallery photos/videos and their captions, dates, and categories.
- Academy contact details.
- Any preferred hero photograph (select an uploaded public image in Settings). The current visual is a clearly labeled microscope illustration, not a photograph of an academy facility.

The seeded module is explicitly illustrative and does not claim a real event, topic, date, or lecturer. No invented credentials, biographies, results, accreditations, or contact details are included.
