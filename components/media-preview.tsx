"use client";
import { Copy } from "@/lib/content";
import { PdfPreview } from "./pdf-preview";
export function MediaPreview({
  id,
  mime,
  title,
  t,
}: {
  id: string;
  mime: string;
  title: string;
  t: Copy;
}) {
  const src = `/api/media/${id}`;
  return mime.startsWith("image/") ? (
    <img src={src} alt={title} />
  ) : mime.startsWith("video/") ? (
    <video controls preload="metadata" src={src} aria-label={title} />
  ) : (
    <PdfPreview id={id} title={title} t={t} />
  );
}
