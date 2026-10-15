"use client";
import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  Plus,
  BookOpen,
  Microscope,
  Users,
  Play,
  CalendarDays,
  Mail,
  ChevronRight,
  ShieldCheck,
  Globe2,
} from "lucide-react";
import { Copy, Lang, RecordData, localized } from "@/lib/content";
type Props = {
  lang: Lang;
  section: string;
  t: Copy;
  settings: RecordData;
  contact?: RecordData;
  doctors: RecordData[];
  modules: RecordData[];
  gallery: RecordData[];
  media: { id: string; mime: string }[];
  detail?: RecordData;
  unlocked: boolean;
  hasFull: boolean;
};
export function Logo({ name = "Galenus Med Academy" }: { name?: string }) {
  return (
    <span className="logo">
      <img src="/logo.svg" alt={name} width={815} height={735} />
    </span>
  );
}
export function PublicSite({
  lang,
  section,
  t,
  settings,
  contact,
  doctors,
  modules,
  gallery,
  media,
  detail,
  unlocked: initialUnlocked,
  hasFull,
}: Props) {
  const [menu, setMenu] = useState(false),
    [filter, setFilter] = useState("all"),
    [unlocked] = useState(initialUnlocked);
  const href = (page: string) => `/${lang}${page === "home" ? "" : `/${page}`}`;
  const nav = (
    Array.isArray(settings.navigation)
      ? settings.navigation
      : ["home", "about", "gallery", "modules"]
  ) as (keyof Copy)[];
  const other = lang === "sq" ? "en" : "sq";
  const text = (r: RecordData, field: string) => localized(r, field, lang);
  const date = (r: RecordData) =>
    r.date
      ? new Intl.DateTimeFormat(lang === "sq" ? "sq-AL" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${r.date}T12:00:00`))
      : t.datePending;
  const arrow = <ArrowUpRight size={18} />;
  function Placeholder({
    kind = "image",
    large = false,
  }: {
    kind?: string;
    large?: boolean;
  }) {
    return (
      <div className={`media-placeholder ${large ? "large" : ""}`}>
        <div className="placeholder-cross">
          <Plus size={large ? 70 : 40} strokeWidth={1} />
        </div>
        <span>
          {kind === "video" ? <Play size={18} /> : <Microscope size={18} />}{" "}
          {t.mediaPending}
        </span>
        <div className="placeholder-grid" />
      </div>
    );
  }
  function ModuleCard({ item }: { item: RecordData }) {
    return (
      <Link className="module-card" href={href(`modules/${item.id}`)}>
        <div className="card-media">
          {item.thumbnail ? (
            <img
              src={`/api/media/${item.thumbnail}`}
              alt={text(item, "title")}
            />
          ) : (
            <Placeholder />
          )}
          <span className="media-tag">{t.modules}</span>
        </div>
        <div className="card-copy">
          <p className="small-meta">
            <CalendarDays size={14} />
            {date(item)}
          </p>
          <h3>{text(item, "title")}</h3>
          <p>{text(item, "description")}</p>
          <div className="card-bottom">
            <span>{item.lecturer || t.pending}</span>
            {arrow}
          </div>
          {item.placeholder && (
            <small className="placeholder-label">{t.placeholder}</small>
          )}
        </div>
      </Link>
    );
  }
  function DoctorSection({ full = false }: { full?: boolean }) {
    return (
      <section className="section doctors-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t.team}</span>
            <h2>{t.doctors}</h2>
          </div>
          <p>{t.doctorIntro}</p>
        </div>
        <div className="doctor-grid">
          {doctors.map((d, i) => (
            <article className="doctor-card" key={d.id}>
              <div className="doctor-photo">
                {d.thumbnail ? (
                  <img src={`/api/media/${d.thumbnail}`} alt={d.name || ""} />
                ) : (
                  <>
                    <svg viewBox="0 0 240 200" aria-hidden="true">
                      <circle cx="120" cy="65" r="30" />
                      <path d="M53 194v-24c0-39 30-63 67-63s67 24 67 63v24" />
                      <path
                        d="m88 116 32 68 32-68M120 184v16"
                        className="coat"
                      />
                    </svg>
                    <span>{t.photoPending}</span>
                  </>
                )}
                <span className="doctor-number">0{i + 1}</span>
              </div>
              <div className="doctor-info">
                <h3>{d.name}</h3>
                <p>{text(d, "specialty") || t.profilePending}</p>
                {full ? (
                  <dl>
                    {[
                      "biography",
                      "specialty",
                      "qualifications",
                      "experience",
                    ].map((f) => (
                      <div key={f}>
                        <dt>{t[f as keyof Copy]}</dt>
                        <dd>{text(d, f) || t.pending}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <Link
                    href={href("about")}
                    aria-label={`${t.about}: ${d.name}`}
                  >
                    {t.about}
                    {arrow}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }
  function Approach() {
    return (
      <div className="approach-grid">
        {[
          [BookOpen, t.theory, t.theoryText],
          [Microscope, t.practice, t.practiceText],
          [Users, t.community, t.communityText],
        ].map(([Icon, title, body], i) => {
          const I = Icon as typeof BookOpen;
          return (
            <article key={i}>
              <span className="line-icon">
                <I size={25} />
              </span>
              <small>0{i + 1}</small>
              <h3>{String(title)}</h3>
              <p>{String(body)}</p>
            </article>
          );
        })}
      </div>
    );
  }
  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <div className="top-strip">
        <div className="container">
          <span>{t.tagline}</span>
          <span>
            {t.medicine} & {t.dentistry}
            <span className="tiny-dot" />
          </span>
        </div>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Link href={href("home")} aria-label={String(settings.siteName)}>
            <Logo name={String(settings.siteName)} />
          </Link>
          <nav aria-label={t.navigation} className={menu ? "nav open" : "nav"}>
            {nav.map((n) => (
              <Link
                key={n}
                href={href(n)}
                className={section === n ? "active" : ""}
                aria-current={section === n ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                {t[n]}
              </Link>
            ))}
            <a href="#contact" onClick={() => setMenu(false)}>
              {t.contact}
            </a>
            <Link
              className="mobile-register"
              href={href("modules") + "#register"}
              onClick={() => setMenu(false)}
            >
              {t.register}
            </Link>
          </nav>
          <div className="header-actions">
            <Link
              className="language-switch"
              href={`/${other}${section === "home" ? "" : `/${section}`}${detail ? `/${detail.id}` : ""}`}
              aria-label={lang === "sq" ? "Switch to English" : "Kalo në shqip"}
            >
              <Globe2 size={15} />
              <span className={lang === "sq" ? "selected" : ""}>SQ</span>
              <span className="language-divider">/</span>
              <span className={lang === "en" ? "selected" : ""}>EN</span>
            </Link>
            <Link
              className="button small header-register"
              href={href("modules") + "#register"}
            >
              {t.register}
              {arrow}
            </Link>
            <button
              className="menu-button"
              aria-expanded={menu}
              aria-label={menu ? t.close : t.menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        {section === "home" && (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="tiny-dot" />
                  {t.eyebrow}
                </span>
                <h1>
                  {t.hero.slice(0, t.hero.lastIndexOf(" "))}{" "}
                  <em>{t.hero.slice(t.hero.lastIndexOf(" ") + 1)}</em>
                </h1>
                <p>{t.intro}</p>
                <div className="hero-buttons">
                  <Link className="button" href={href("modules")}>
                    {t.explore}
                    {arrow}
                  </Link>
                  <Link className="text-link" href={href("about")}>
                    {t.discover}
                    <ArrowRight size={17} />
                  </Link>
                </div>
                <div className="hero-note">
                  <span className="note-line" />
                  <span>{t.tagline}</span>
                </div>
              </div>
              <div className="hero-art" role="img" aria-label={t.mediaPending}>
                <div className="art-grid" />
                <span className="art-label">
                  GALENUS <span>—</span> MED ACADEMY
                </span>
                {!!settings.heroMedia && (
                  <img
                    className="hero-custom-image"
                    src={`/api/media/${settings.heroMedia}`}
                    alt={t.hero}
                  />
                )}
                <svg
                  style={settings.heroMedia ? { display: "none" } : undefined}
                  viewBox="0 0 500 510"
                  className="microscope-art"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="metal" x1="0" x2="1">
                      <stop stopColor="#c6e5df" />
                      <stop offset=".45" stopColor="#f5ffff" />
                      <stop offset="1" stopColor="#86b8b3" />
                    </linearGradient>
                    <linearGradient id="dark" x1="0" x2="1">
                      <stop stopColor="#02454e" />
                      <stop offset="1" stopColor="#07656a" />
                    </linearGradient>
                    <filter id="shadow">
                      <feDropShadow
                        dx="9"
                        dy="16"
                        stdDeviation="12"
                        floodOpacity=".16"
                      />
                    </filter>
                  </defs>
                  <circle
                    cx="260"
                    cy="260"
                    r="181"
                    fill="none"
                    stroke="#fff"
                    opacity=".28"
                  />
                  <circle
                    cx="260"
                    cy="260"
                    r="210"
                    fill="none"
                    stroke="#fff"
                    opacity=".15"
                  />
                  <g filter="url(#shadow)" transform="rotate(-8 250 280)">
                    <path
                      d="M269 165C409 181 431 385 296 411l-39-53c86-14 75-117-9-120z"
                      fill="url(#metal)"
                    />
                    <path d="M145 435h228l18 29H124z" fill="url(#metal)" />
                    <path d="M264 356h51v87h-51z" fill="url(#metal)" />
                    <rect
                      x="116"
                      y="307"
                      width="189"
                      height="20"
                      rx="5"
                      fill="url(#dark)"
                    />
                    <rect
                      x="179"
                      y="111"
                      width="71"
                      height="148"
                      rx="10"
                      transform="rotate(28 215 185)"
                      fill="url(#metal)"
                    />
                    <rect
                      x="211"
                      y="83"
                      width="53"
                      height="44"
                      rx="5"
                      transform="rotate(28 238 105)"
                      fill="url(#dark)"
                    />
                    <path d="m158 244 43 23-23 37-31-17z" fill="url(#dark)" />
                    <circle cx="312" cy="264" r="34" fill="url(#dark)" />
                    <circle cx="312" cy="264" r="21" fill="#41858a" />
                    <circle cx="312" cy="264" r="10" fill="#beddd9" />
                    <path d="m217 355 30 20-14 29-30-20z" fill="url(#dark)" />
                  </g>
                  <path
                    d="M79 185h20m-10-10v20M394 366h20m-10-10v20"
                    stroke="#fff"
                    opacity=".7"
                  />
                </svg>
                <div className="art-caption">
                  <span>01 / {t.perspective}</span>
                  <strong>{t.artTitle}</strong>
                  <small>
                    {t.mediaPending} · {t.illustration}
                  </small>
                </div>
                <div className="art-corner">
                  <ArrowUpRight size={28} />
                </div>
              </div>
            </section>
            <div className="discipline-band">
              <div className="container">
                <span>
                  <Plus size={18} />
                  {t.medicine}
                </span>
                <i />
                <span>
                  <Plus size={18} />
                  {t.dentistry}
                </span>
                <i />
                <span>
                  <Plus size={18} />
                  {t.development}
                </span>
              </div>
            </div>
            <section className="section container">
              <div className="section-heading approach-heading">
                <div>
                  <span className="eyebrow">GALENUS MED ACADEMY</span>
                  <h2>{t.approach}</h2>
                </div>
                <div>
                  <p>{t.aboutText}</p>
                  <Link className="text-link" href={href("about")}>
                    {t.about}
                    {arrow}
                  </Link>
                </div>
              </div>
              <Approach />
            </section>
            <section className="learning-section">
              <div className="container section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{t.learning}</span>
                    <h2>{t.featured}</h2>
                  </div>
                  <Link className="outline-button" href={href("modules")}>
                    {t.allModules}
                    {arrow}
                  </Link>
                </div>
                <div className="featured-grid">
                  {modules
                    .filter((w) => w.featured)
                    .slice(0, 2)
                    .map((w) => (
                      <ModuleCard key={w.id} item={w} />
                    ))}
                  <div className="library-card">
                    <span className="line-icon">
                      <BookOpen size={27} />
                    </span>
                    <h3>{t.modules}</h3>
                    <p>{t.libraryText}</p>
                    <Link className="text-link" href={href("modules")}>
                      {t.explore}
                      <ArrowRight size={20} />
                    </Link>
                    <span className="library-circle" />
                  </div>
                </div>
              </div>
            </section>
            <div className="container">
              <DoctorSection />
              <section className="gallery-preview">
                <div>
                  <span className="eyebrow">{t.gallery}</span>
                  <h2>{t.galleryTitle}</h2>
                  <p>{t.galleryLinkText}</p>
                  <Link className="text-link" href={href("gallery")}>
                    {t.viewGallery}
                    {arrow}
                  </Link>
                </div>
                <div className="gallery-preview-art">
                  <Placeholder />
                  <span className="gallery-figure">
                    G<span>+</span>
                  </span>
                </div>
              </section>
            </div>
          </>
        )}
        {section === "about" && (
          <>
            <section className="page-intro container">
              <span className="eyebrow">{t.about}</span>
              <h1>{t.approach}</h1>
              <p>{t.aboutText}</p>
            </section>
            <section className="container about-mission">
              <div className="mission-block">
                <span className="line-icon">
                  <Microscope size={32} />
                </span>
                <h2>{t.mission}</h2>
                <p>{t.missionText}</p>
              </div>
              <Approach />
            </section>
            <div className="container">
              <DoctorSection full />
            </div>
          </>
        )}
        {section === "gallery" && (
          <section className="container section">
            <div className="page-intro compact">
              <span className="eyebrow">{t.gallery}</span>
              <h1>{t.galleryTitle}</h1>
              <p>{t.galleryText}</p>
            </div>
            <div className="filter-bar">
              {[
                "all",
                ...Array.from(
                  new Set(
                    gallery.map((g) => text(g, "category")).filter(Boolean),
                  ),
                ),
              ].map((c) => (
                <button
                  key={c}
                  className={filter === c ? "filter active" : "filter"}
                  onClick={() => setFilter(c)}
                >
                  {c === "all" ? t.all : c}
                </button>
              ))}
            </div>
            {gallery.length ? (
              <div className="gallery-grid">
                {gallery
                  .filter(
                    (g) => filter === "all" || text(g, "category") === filter,
                  )
                  .map((g) => (
                    <article className="gallery-item" key={g.id}>
                      {g.media ? (
                        media
                          .find((m) => m.id === g.media)
                          ?.mime.startsWith("video") ? (
                          <video
                            controls
                            preload="metadata"
                            src={`/api/media/${g.media}`}
                            aria-label={text(g, "title")}
                          />
                        ) : (
                          <img
                            src={`/api/media/${g.media}`}
                            alt={text(g, "description") || text(g, "title")}
                          />
                        )
                      ) : (
                        <Placeholder />
                      )}
                      <div className="gallery-item-copy">
                        <span className="small-meta">
                          {date(g)} · {text(g, "category")}
                        </span>
                        <h3>{text(g, "title")}</h3>
                        <p>{text(g, "description")}</p>
                        {g.placeholder && <small>{t.placeholder}</small>}
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <div className="empty-state">
                <Placeholder large />
                <h3>{t.emptyGallery}</h3>
              </div>
            )}
          </section>
        )}
        {section === "modules" && !detail && (
          <section className="container section">
            <div className="page-intro compact">
              <span className="eyebrow">{t.learning}</span>
              <h1>{t.modules}</h1>
              <p>{t.libraryText}</p>
            </div>
            <div className="module-grid">
              {modules.map((w) => (
                <ModuleCard key={w.id} item={w} />
              ))}
            </div>
            {!modules.length && (
              <div className="empty-state">
                <BookOpen size={40} />
                <p>{t.emptyModules}</p>
              </div>
            )}
          </section>
        )}
        {detail && (
          <section className="container section module-detail">
            <Link className="text-link" href={href("modules")}>
              ← {t.back}
            </Link>
            <div className="detail-heading">
              <span className="eyebrow">{t.modules}</span>
              <h1>{text(detail, "title")}</h1>
              {text(detail, "description")
                .split(/\n\s*\n/)
                .map((paragraph, i) => (
                  <p className="preserve-lines" key={i}>
                    {paragraph}
                  </p>
                ))}
              <div className="detail-meta">
                <span>
                  <Users size={16} />
                  {detail.lecturer || t.pending}
                </span>
                <span>
                  <CalendarDays size={16} />
                  {date(detail)}
                </span>
              </div>
              {text(detail, "lecturerDetails") && (
                <p className="preserve-lines">
                  <strong>{t.lecturerDetails}</strong>
                  <br />
                  {text(detail, "lecturerDetails")}
                </p>
              )}
              {detail.placeholder && (
                <p className="placeholder-label">{t.placeholder}</p>
              )}
            </div>
            <div className="detail-grid">
              <div>
                {detail.thumbnail ? (
                  <img
                    className="module-cover"
                    src={`/api/media/${detail.thumbnail}`}
                    alt={text(detail, "title")}
                  />
                ) : (
                  <Placeholder large />
                )}
                {unlocked &&
                  (detail.resources || [])
                    .filter((r) => r.language === "both" || r.language === lang)
                    .sort((a, b) => a.order - b.order)
                    .map((r) => (
                      <article className="resource-public" key={r.id}>
                        <h3>
                          {text(r as unknown as RecordData, "title") ||
                            r.title_sq}
                        </h3>
                        <p className="preserve-lines">
                          {text(r as unknown as RecordData, "description") ||
                            r.description_sq}
                        </p>
                        {r.mime?.startsWith("video/") ? (
                          <video
                            controls
                            preload="metadata"
                            src={`/api/resources/${detail.id}/${r.id}`}
                          />
                        ) : r.mime?.startsWith("image/") ? (
                          <img
                            src={`/api/resources/${detail.id}/${r.id}`}
                            alt={
                              text(r as unknown as RecordData, "title") ||
                              r.title_sq
                            }
                          />
                        ) : (
                          <a
                            className="outline-button"
                            href={`/api/resources/${detail.id}/${r.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t.openResource} ? PDF
                          </a>
                        )}
                      </article>
                    ))}
                {unlocked && hasFull && (
                  <div className="protected-material">
                    <h2>{t.full}</h2>
                    <video
                      controls
                      preload="metadata"
                      src={`/api/watch/${detail.id}`}
                      aria-label={t.full}
                    />
                  </div>
                )}
              </div>
              <aside className="access-card">
                <BookOpen size={28} />
                <h2>{t.resources}</h2>
                <p>{t.protectedHelp}</p>
                <Link className="button" href={href("modules") + "#register"}>
                  {t.register}
                </Link>
              </aside>
            </div>
          </section>
        )}
        {(section === "home" || (section === "modules" && !detail)) && (
          <NewsletterForm t={t} lang={lang} />
        )}
        {
          <section className="cta-section">
            <div className="container">
              <div>
                <span className="eyebrow">GALENUS MED ACADEMY</span>
                <h2>{t.cta}</h2>
                <p>{t.ctaText}</p>
              </div>
              <Link className="button teal" href={href("modules")}>
                {t.explore}
                {arrow}
              </Link>
            </div>
          </section>
        }
      </main>
      <footer id="contact">
        <div className="container footer-main">
          <div className="footer-brand">
            <Link href={href("home")}>
              <Logo name={String(settings.siteName)} />
            </Link>
            <p>{t.footerText}</p>
          </div>
          <div>
            <h3>{t.navigation}</h3>
            {nav.map((n) => (
              <Link key={n} href={href(n)}>
                {t[n]}
                <ChevronRight size={13} />
              </Link>
            ))}
          </div>
          <div>
            <h3>{t.contact}</h3>
            {contact ? (
              <>
                {!!contact.email && (
                  <a href={`mailto:${contact.email}`}>
                    <Mail size={15} />
                    {String(contact.email)}
                  </a>
                )}
                {!!contact.phone && (
                  <a
                    href={`tel:${String(contact.phone).replace(/[\s().-]/g, "")}`}
                  >
                    {String(contact.phone)}
                  </a>
                )}
                {text(contact, "address") && (
                  <p className="preserve-lines">{text(contact, "address")}</p>
                )}
                {text(contact, "hours") && (
                  <p className="preserve-lines">{text(contact, "hours")}</p>
                )}
              </>
            ) : (
              <p>{t.contactPending}</p>
            )}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} {String(settings.siteName)}
          </span>
          <span>{t.tagline}</span>
        </div>
      </footer>
    </>
  );
}
