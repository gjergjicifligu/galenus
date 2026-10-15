"use client";
import { useState } from "react";
import { Copy, ModuleResource } from "@/lib/content";
import { MediaPreview } from "./media-preview";
type Asset = { id: string; name: string; mime: string; private: number };
export function ResourceEditor({
  t,
  resources,
  media,
  onChange,
  onUploaded,
}: {
  t: Copy;
  resources: ModuleResource[];
  media: Asset[];
  onChange: (resources: ModuleResource[]) => void;
  onUploaded: (asset: Asset) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const update = (index: number, value: Partial<ModuleResource>) =>
    onChange(resources.map((r, i) => (i === index ? { ...r, ...value } : r)));
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("private", "true");
        const res = await fetch("/api/media", { method: "POST", body: form }),
          result = await res.json();
        if (!res.ok) throw new Error(t[result.error as keyof Copy] || t.error);
        const assets = (await (await fetch("/api/media")).json()) as Asset[];
        onUploaded(assets.find((a) => a.id === result.id)!);
      }
      setMessage(t.saved);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="resource-editor">
      <h3>{t.resources}</h3>
      <p>{t.resourceHelp}</p>
      <p>{t.pdfHelp}</p>
      <label>
        {t.upload}
        <input
          type="file"
          disabled={busy}
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf"
          onChange={(e) => void upload(e.target.files)}
        />
      </label>
      <p role="status">{busy ? t.loading : message}</p>
      {resources.map((r, i) => (
        <fieldset className="resource-item" key={r.id}>
          <legend>
            {t.resources} {i + 1}
          </legend>
          <label>
            {t.chooseMedia}
            <select
              aria-label={t.chooseMedia}
              value={r.media}
              required
              onChange={(e) =>
                update(i, {
                  media: e.target.value,
                  mime: media.find((m) => m.id === e.target.value)?.mime,
                })
              }
            >
              <option value="">{t.chooseMedia}</option>
              {media
                .filter((m) => m.private)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          {r.media && (
            <MediaPreview
              t={t}
              id={r.media}
              mime={media.find((m) => m.id === r.media)?.mime || r.mime || ""}
              title={r.title_sq || t.resources}
            />
          )}
          <div className="bilingual-fields">
            {(["sq", "en"] as const).map((lang) => (
              <fieldset key={lang}>
                <legend>{lang === "sq" ? "Shqip" : "English"}</legend>
                <label>
                  {t.title}
                  <input
                    value={r[`title_${lang}`]}
                    required={lang === "sq"}
                    maxLength={200}
                    onChange={(e) =>
                      update(i, { [`title_${lang}`]: e.target.value })
                    }
                  />
                </label>
                <label>
                  {t.description}
                  <textarea
                    aria-label={t.description}
                    value={r[`description_${lang}`]}
                    onChange={(e) =>
                      update(i, { [`description_${lang}`]: e.target.value })
                    }
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <div className="name-fields">
            <label>
              {t.resourceLanguage}
              <select
                aria-label={t.resourceLanguage}
                value={r.language}
                onChange={(e) =>
                  update(i, {
                    language: e.target.value as ModuleResource["language"],
                  })
                }
              >
                <option value="both">{t.bothLanguages}</option>
                <option value="sq">Shqip</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              {t.resourceOrder}
              <input
                type="number"
                min={0}
                max={10000}
                value={r.order}
                onChange={(e) => update(i, { order: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={r.published}
              onChange={(e) => update(i, { published: e.target.checked })}
            />
            {t.published}
          </label>
          <button
            type="button"
            className="outline-button"
            onClick={() =>
              onChange(resources.filter((_, index) => index !== i))
            }
          >
            {t.delete}
          </button>
        </fieldset>
      ))}
      <button
        className="outline-button"
        type="button"
        disabled={resources.length >= 50 || busy}
        onClick={() =>
          onChange([
            ...resources,
            {
              id: crypto.randomUUID(),
              media: "",
              title_sq: "",
              title_en: "",
              description_sq: "",
              description_en: "",
              language: "both",
              order: resources.length,
              published: false,
            },
          ])
        }
      >
        {t.addResource}
      </button>
    </section>
  );
}
