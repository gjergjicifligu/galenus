"use client";
import { useEffect, useRef, useState } from "react";
import { Copy } from "@/lib/content";
export function PdfPreview({
  id,
  title,
  t,
}: {
  id: string;
  title: string;
  t: Copy;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [pages, setPages] = useState(0);
  useEffect(() => {
    let cancelled = false,
      dispose: undefined | (() => void);
    setLoading(true);
    setError(false);
    async function render() {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({
          url: `/api/media/${id}`,
          useSystemFonts: true,
        });
        dispose = () => {
          void task.destroy();
        };
        const pdf = await task.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled || !canvas.current) return;
        const original = page.getViewport({ scale: 1 }),
          scale = Math.min(300 / original.height, 520 / original.width),
          viewport = page.getViewport({ scale });
        const element = canvas.current,
          pixelRatio = window.devicePixelRatio || 1;
        element.width = Math.ceil(viewport.width * pixelRatio);
        element.height = Math.ceil(viewport.height * pixelRatio);
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        await page.render({
          canvas: element,
          viewport,
          transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
        }).promise;
        if (!cancelled) {
          setPages(pdf.numPages);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [id]);
  return (
    <div className="pdf-preview" aria-busy={loading}>
      {loading && <p role="status">{t.loading}</p>}
      {error && <p role="alert">{t.previewUnavailable}</p>}
      <canvas
        ref={canvas}
        aria-label={`${title} · PDF`}
        style={{ display: loading || error ? "none" : "block" }}
      />
      {!loading && !error && <small>1 / {pages}</small>}
      <a href={`/api/media/${id}`} target="_blank" rel="noreferrer">
        PDF · {title} ↗
      </a>
    </div>
  );
}
