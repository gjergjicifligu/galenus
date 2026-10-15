"use client";
import { useState } from "react";
import { Copy, Lang } from "@/lib/content";
export function NewsletterForm({ t, lang }: { t: Copy; lang: Lang }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          consent: data.get("consent") === "on",
          language: lang,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(t[result.error as keyof Copy] || t.error);
      setSuccess(true);
      setMessage(t.newsletterSuccess);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="register" className="newsletter-section container">
      <div>
        <span className="eyebrow">GALENUS MED ACADEMY</span>
        <h2>{t.newsletter}</h2>
        <p>{t.newsletterIntro}</p>
      </div>
      <div>
        {!success && (
          <form onSubmit={submit} className="newsletter-form">
            <div className="name-fields">
              <label>
                {t.firstName}
                <input
                  name="firstName"
                  autoComplete="given-name"
                  required
                  maxLength={100}
                />
              </label>
              <label>
                {t.lastName}
                <input
                  name="lastName"
                  autoComplete="family-name"
                  required
                  maxLength={100}
                />
              </label>
            </div>
            <label>
              {t.email}
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label className="checkbox-label">
              <input name="consent" type="checkbox" required />
              <span>{t.newsletterConsent}</span>
            </label>
            <button className="button" disabled={busy}>
              {busy ? t.loading : t.register}
            </button>
          </form>
        )}
        <p
          role="status"
          aria-live="polite"
          className={success ? "success" : ""}
        >
          {message}
        </p>
      </div>
    </section>
  );
}
