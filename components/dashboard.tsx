"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  LayoutDashboard,
  Images,
  Video,
  Users,
  Settings,
  BookOpen,
  LogOut,
  Plus,
  Trash2,
  Save,
  Upload,
  Mail,
  Search,
  X,
} from "lucide-react";
import { Copy, Lang, RecordData } from "@/lib/content";
import type { Staff } from "@/lib/security";
import { MediaUpload } from "./media-upload";
import { ResourceEditor } from "./resource-editor";
import { MediaPreview } from "./media-preview";
import { CampaignDashboard } from "./campaign-dashboard";
import { ModuleResource } from "@/lib/content";
import { Logo } from "./public-site";
type Row = Record<string, unknown>;
export function Dashboard({
  lang,
  t,
  initialUser,
}: {
  lang: Lang;
  t: Copy;
  initialUser: Staff | null;
}) {
  const [user, setUser] = useState(initialUser),
    [tab, setTab] = useState("modules"),
    [rows, setRows] = useState<Row[]>([]),
    [media, setMedia] = useState<Row[]>([]),
    [edit, setEdit] = useState<Row | null>(null),
    [viewing, setViewing] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [query, setQuery] = useState("");
  const tr = (key: string) =>
    key === "subscriptions" ? t.legacyEnrollments : t[key as keyof Copy] || key;
  const requestVersion = useRef(0);
  const rowLabel = (row: Row) =>
    tab === "pages"
      ? row.id === "copy-sq"
        ? "Shqip"
        : "English"
      : String(row.name || row.email || row[`title_${lang}`] || tr(tab));
  async function api(url: string, options?: RequestInit) {
    const response = await fetch(`/api/${url}`, options);
    const value = await response.json();
    if (!response.ok) throw new Error(tr(value.error || "error"));
    return value;
  }
  async function load() {
    if (tab === "campaigns") return;
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const result = await api(tab);
      if (version !== requestVersion.current) return;
      setRows(result);
      if (["modules", "gallery", "doctors", "settings"].includes(tab)) {
        const assets = await api("media");
        if (version === requestVersion.current) setMedia(assets);
      }
    } catch (e) {
      if (version === requestVersion.current) setMessage((e as Error).message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (user) {
      setEdit(null);
      setViewing(false);
      setMessage("");
      setQuery("");
      void load();
    }
    return () => {
      requestVersion.current++;
    };
  }, [tab, user]); // Each panel reloads protected server data.
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(e.currentTarget);
    try {
      await api("auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data)),
      });
      const result = await api("auth");
      setUser(result.user);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("auth", { method: "DELETE" });
      setUser(null);
      setRows([]);
      setEdit(null);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api(tab, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      setEdit(null);
      await load();
      setMessage(t.saved);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: unknown) {
    if (!confirm(t.confirmDelete)) return;
    setBusy(true);
    try {
      await api(`${tab}/${id}`, { method: "DELETE" });
      await load();
      setMessage(t.saved);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function togglePublication(row: Row) {
    setBusy(true);
    setMessage("");
    try {
      await api(tab, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...row, published: !row.published }),
      });
      await load();
      setMessage(t.saved);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field(key: string, label: string, type = "text") {
    return (
      <label key={key}>
        {label}
        {type === "textarea" ? (
          <textarea
            aria-label={label}
            rows={4}
            value={String(edit?.[key] || "")}
            onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
          />
        ) : (
          <input
            aria-label={label}
            type={type}
            value={String(edit?.[key] || "")}
            minLength={type === "password" ? 12 : undefined}
            onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
          />
        )}
      </label>
    );
  }
  function check(key: string, label: string) {
    return (
      <label className="checkbox-label" key={key}>
        <input
          type="checkbox"
          checked={!!edit?.[key]}
          onChange={(e) => setEdit({ ...edit, [key]: e.target.checked })}
        />
        {label}
      </label>
    );
  }
  function mediaField(
    key: string,
    label: string,
    privateOnly = false,
    videoOnly = false,
  ) {
    return (
      <label>
        {label}
        <select
          aria-label={label}
          value={String(edit?.[key] || "")}
          onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
        >
          <option value="">{t.chooseMedia}</option>
          {media
            .filter(
              (m) =>
                !!m.private === privateOnly &&
                (videoOnly
                  ? String(m.mime).startsWith("video/")
                  : ["thumbnail", "heroMedia"].includes(key)
                    ? String(m.mime).startsWith("image/")
                    : /^(image|video)\//.test(String(m.mime))),
            )
            .map((m) => (
              <option key={String(m.id)} value={String(m.id)}>
                {String(m.name)}
              </option>
            ))}
        </select>
        {!!edit?.[key] && (
          <div className="selected-media">
            {String(media.find((m) => m.id === edit[key])?.mime).startsWith(
              "image/",
            ) ? (
              <img src={`/api/media/${edit[key]}`} alt={label} />
            ) : (
              <video
                controls
                preload="metadata"
                src={`/api/media/${edit[key]}`}
                aria-label={label}
              />
            )}
          </div>
        )}
      </label>
    );
  }
  const tabs =
    user?.role === "admin"
      ? [
          "pages",
          "doctors",
          "contacts",

          "gallery",
          "modules",
          "media",
          "subscriptions",
          "campaigns",
          "users",
          "settings",
        ]
      : ["gallery", "modules", "media"];
  const icons: Record<string, typeof Video> = {
    pages: BookOpen,
    doctors: Users,
    gallery: Images,
    modules: Video,
    media: Upload,
    subscriptions: Mail,
    campaigns: Mail,
    users: Users,
    settings: Settings,
    contacts: Mail,
  };
  if (!user)
    return (
      <main className="login-page">
        <div className="login-brand">
          <Link href={`/${lang}`}>
            <Logo />
          </Link>
          <span>{t.tagline}</span>
        </div>
        <section className="login-card">
          <span className="line-icon">
            <LayoutDashboard />
          </span>
          <h1>{t.login}</h1>
          <p>{t.noAccess}</p>
          <form onSubmit={login}>
            <label>
              {t.email}
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </label>
            <label>
              {t.password}
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <button className="button" disabled={busy}>
              {busy ? t.loading : t.signIn}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <p role="alert">{message}</p>
          <div className="login-links">
            <Link href={`/${lang}`}>{t.returnHome}</Link>
            <Link href={`/${lang === "sq" ? "en" : "sq"}/manage`}>
              {lang === "sq" ? "English" : "Shqip"}
            </Link>
          </div>
        </section>
      </main>
    );
  return (
    <div className="dashboard">
      <aside className="dashboard-sidebar">
        <Link href={`/${lang}`}>
          <Logo />
        </Link>
        <span className="eyebrow">{t.dashboard}</span>
        <nav aria-label={t.dashboard}>
          {tabs.map((key) => {
            const Icon = icons[key];
            return (
              <button
                key={key}
                className={tab === key ? "selected" : ""}
                onClick={() => {
                  if (key === tab) return;
                  requestVersion.current++;
                  setRows([]);
                  setEdit(null);
                  setViewing(false);
                  setLoading(true);
                  setTab(key);
                }}
                disabled={busy}
              >
                <Icon size={18} />
                {tr(key)}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <span className="user-avatar">{user.name.charAt(0)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{tr(user.role)}</small>
          </div>
          <button onClick={logout} aria-label={t.signOut}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-top">
          <span>{t.manageIntro}</span>
          <div>
            <Link href={`/${lang === "sq" ? "en" : "sq"}/manage`}>
              {lang === "sq" ? "EN" : "SQ"}
            </Link>
            <Link href={`/${lang}`}>
              {t.home}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </header>
        <div className="dashboard-content">
          <div className="dashboard-title">
            <div>
              <span className="eyebrow">GALENUS MED ACADEMY</span>
              <h1>{tr(tab)}</h1>
            </div>
            {![
              "pages",
              "settings",
              "media",
              "subscriptions",
              "campaigns",
            ].includes(tab) &&
              !(["contacts"].includes(tab) && rows.length > 0) && (
                <button
                  className="button"
                  onClick={() => {
                    setMessage("");
                    setViewing(false);
                    setEdit(
                      tab === "users"
                        ? { name: "", email: "", role: "user", password: "" }
                        : {
                            id:
                              tab === "contacts"
                                ? "contact-details"
                                : crypto.randomUUID(),
                            kind: tab,
                            published: false,
                            placeholder: false,
                          },
                    );
                  }}
                >
                  <Plus size={17} />
                  {t.add}
                </button>
              )}
          </div>
          <div
            role="status"
            aria-live="polite"
            className={message ? "status-message" : ""}
          >
            {message}
          </div>
          {tab === "media" && (
            <MediaUpload t={t} onUpload={load} onBusy={setBusy} />
          )}
          {tab === "subscriptions" && <p>{t.retention}</p>}
          {tab === "campaigns" ? (
            <CampaignDashboard t={t} lang={lang} />
          ) : edit ? (
            <form className="editor-panel" onSubmit={save}>
              <div className="editor-top">
                <h2>{rowLabel(edit)}</h2>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setEdit(null)}
                  aria-label={t.close}
                >
                  <X />
                </button>
              </div>
              {viewing && (
                <section className="saved-preview">
                  {(["thumbnail", "media", "fullMedia"] as const).map((key) => {
                    if (!edit[key]) return null;
                    const asset = media.find((m) => m.id === edit[key]);
                    return (
                      <figure key={key}>
                        <figcaption>{tr(key)}</figcaption>
                        {String(asset?.mime).startsWith("image/") ? (
                          <img
                            src={`/api/media/${edit[key]}`}
                            alt={rowLabel(edit)}
                          />
                        ) : (
                          <video
                            controls
                            preload="metadata"
                            src={`/api/media/${edit[key]}`}
                            aria-label={tr(key)}
                          />
                        )}
                      </figure>
                    );
                  })}
                  {!!edit.published &&
                    ["doctors", "contacts", "gallery", "modules"].includes(
                      tab,
                    ) && (
                      <a
                        className="text-link"
                        target="_blank"
                        rel="noreferrer"
                        href={`/${lang}/${tab === "doctors" ? "about" : tab === "contacts" ? "#contact" : tab === "modules" ? `modules/${edit.id}` : tab}`}
                      >
                        {t.viewPublic}
                        <ArrowUpRight size={16} />
                      </a>
                    )}
                </section>
              )}
              <fieldset disabled={viewing} className="editor-fields">
                {tab === "pages" ? (
                  <>
                    <label className="search-field">
                      <Search size={17} />
                      <input
                        aria-label={t.pages}
                        placeholder={t.pages}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <p>{edit.id === "copy-sq" ? "Shqip" : "English"}</p>
                    <div className="translation-fields">
                      {Object.keys(t)
                        .filter(
                          (k) =>
                            !["id", "kind"].includes(k) &&
                            (k.toLowerCase().includes(query.toLowerCase()) ||
                              String(edit[k])
                                .toLowerCase()
                                .includes(query.toLowerCase())),
                        )
                        .map((k) => field(k, k, "textarea"))}
                    </div>
                  </>
                ) : tab === "settings" ? (
                  <>
                    {field("siteName", t.siteName)}
                    {mediaField("heroMedia", t.heroMedia)}
                    <fieldset>
                      <legend>{t.navigation}</legend>
                      {["home", "about", "gallery", "modules"].map((key) => (
                        <label className="checkbox-label" key={key}>
                          <input
                            type="checkbox"
                            checked={(edit.navigation as string[]).includes(
                              key,
                            )}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                navigation: e.target.checked
                                  ? [...(edit.navigation as string[]), key]
                                  : (edit.navigation as string[]).filter(
                                      (n) => n !== key,
                                    ),
                              })
                            }
                          />
                          {tr(key)}
                        </label>
                      ))}
                    </fieldset>
                  </>
                ) : ["contacts"].includes(tab) ? (
                  <>
                    {tab === "contacts" && (
                      <>
                        {field("email", t.contactEmail, "email")}
                        {field("phone", t.phone, "tel")}
                      </>
                    )}
                    <div className="bilingual-fields">
                      {(["sq", "en"] as const).map((l) => (
                        <fieldset key={l}>
                          <legend>{l === "sq" ? "Shqip" : "English"}</legend>
                          {["address", "hours"].map((f) =>
                            field(`${f}_${l}`, tr(f), "textarea"),
                          )}
                        </fieldset>
                      ))}
                    </div>
                    {check("published", t.published)}
                  </>
                ) : tab === "users" ? (
                  <>
                    {field("name", t.name)}
                    {field("email", t.email, "email")}
                    {field("password", t.requiredPassword, "password")}
                    <small>{t.blankPassword}</small>
                    <label>
                      {t.role}
                      <select
                        value={String(edit.role)}
                        onChange={(e) =>
                          setEdit({ ...edit, role: e.target.value })
                        }
                      >
                        <option value="user">{t.user}</option>
                        <option value="admin">{t.admin}</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    {tab === "doctors" && field("name", t.name)}
                    <div className="bilingual-fields">
                      {(["sq", "en"] as const).map((l) => (
                        <fieldset key={l}>
                          <legend>{l === "sq" ? "Shqip" : "English"}</legend>
                          {(tab === "doctors"
                            ? [
                                "biography",
                                "specialty",
                                "qualifications",
                                "experience",
                              ]
                            : tab === "modules"
                              ? [
                                  "title",
                                  "description",
                                  "category",
                                  "lecturerDetails",
                                ]
                              : ["title", "description", "category"]
                          ).map((f) =>
                            field(
                              `${f}_${l}`,
                              tr(f),
                              [
                                "description",
                                "biography",
                                "experience",
                                "qualifications",
                                "lecturerDetails",
                              ].includes(f)
                                ? "textarea"
                                : "text",
                            ),
                          )}
                        </fieldset>
                      ))}
                    </div>
                    {tab !== "doctors" && field("date", t.date, "date")}
                    {tab === "modules" && field("lecturer", t.lecturer)}
                    {mediaField("thumbnail", t.thumbnail)}
                    {tab === "gallery" && mediaField("media", t.media)}
                    {tab === "modules" && (
                      <>
                        {mediaField("fullMedia", t.fullMedia, true, true)}
                        {check("featured", t.featuredLabel)}
                        <ResourceEditor
                          t={t}
                          resources={(edit.resources as ModuleResource[]) || []}
                          media={
                            media as {
                              id: string;
                              name: string;
                              mime: string;
                              private: number;
                            }[]
                          }
                          onChange={(resources) =>
                            setEdit({ ...edit, resources })
                          }
                          onUploaded={(asset) =>
                            setMedia((previous) => [...previous, asset])
                          }
                        />
                      </>
                    )}
                    {check("published", t.published)}
                    {check("placeholder", t.placeholderLabel)}
                  </>
                )}
              </fieldset>
              <div className="editor-actions">
                {viewing ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => setViewing(false)}
                  >
                    {t.edit}
                  </button>
                ) : (
                  <button className="button" disabled={busy}>
                    <Save size={17} />
                    {busy ? t.loading : t.save}
                  </button>
                )}
              </div>
            </form>
          ) : loading ? (
            <p aria-busy="true">{t.loading}</p>
          ) : tab === "media" && rows.length ? (
            <div className="media-library">
              {rows.map((r) => (
                <article className="media-library-card" key={String(r.id)}>
                  <MediaPreview
                    t={t}
                    id={String(r.id)}
                    mime={String(r.mime)}
                    title={String(r.name)}
                  />
                  <div>
                    <strong>{String(r.name)}</strong>
                    <p>
                      {r.private ? t.privateMedia : t.publicMedia} ·{" "}
                      {String(r.mime)}
                    </p>
                    <button
                      className="outline-button small"
                      disabled={busy}
                      onClick={() => remove(r.id)}
                    >
                      {t.delete}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : rows.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tab === "subscriptions" ? t.email : t.name}</th>
                    <th>
                      {tab === "subscriptions"
                        ? t.modules
                        : tab === "users"
                          ? t.role
                          : tab === "media"
                            ? t.media
                            : t.published}
                    </th>
                    <th>
                      <span className="sr-only">{t.settings}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.id)}>
                      <td>
                        <strong>{rowLabel(r)}</strong>
                        {tab === "subscriptions" && (
                          <small>
                            {String(r.first_name || "")}{" "}
                            {String(r.last_name || "")} ·{" "}
                            {String(r.registered_at)}
                          </small>
                        )}
                      </td>
                      <td>
                        {tab === "subscriptions" ? (
                          String(r.module)
                        ) : tab === "users" ? (
                          tr(String(r.role))
                        ) : tab === "media" ? (
                          <span className="badge">
                            {r.private ? t.privateMedia : t.publicMedia} ·{" "}
                            {String(r.mime)}
                          </span>
                        ) : ["pages", "settings"].includes(tab) ? (
                          "—"
                        ) : (
                          <span className="badge">
                            {r.published ? t.published : t.draft}
                          </span>
                        )}
                      </td>
                      <td className="row-actions">
                        {["doctors", "contacts", "gallery", "modules"].includes(
                          tab,
                        ) && (
                          <>
                            <button
                              className="outline-button small"
                              onClick={() => {
                                setEdit({ ...r });
                                setViewing(true);
                                setMessage("");
                              }}
                            >
                              {t.view}
                            </button>
                            <button
                              className="outline-button small"
                              disabled={busy}
                              onClick={() => togglePublication(r)}
                            >
                              {r.published ? t.unpublish : t.publish}
                            </button>
                          </>
                        )}
                        {!["subscriptions", "media"].includes(tab) && (
                          <button
                            className="outline-button small"
                            onClick={() => {
                              setEdit({ ...r });
                              setViewing(false);
                              setMessage("");
                            }}
                          >
                            {t.edit}
                            <ArrowUpRight size={15} />
                          </button>
                        )}
                        {!["pages", "settings"].includes(tab) && (
                          <button
                            className="icon-button danger"
                            aria-label={`${t.delete}: ${r.name || r.email || r.id}`}
                            disabled={busy || r.id === user.id}
                            onClick={() => remove(r.id)}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                        {tab === "media" && (
                          <a
                            href={`/api/media/${r.id}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t.preview}
                          >
                            <ArrowUpRight size={18} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <BookOpen size={32} />
              <p>{t.noRecords}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
