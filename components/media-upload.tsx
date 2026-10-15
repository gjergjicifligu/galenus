"use client";
import { useRef, useState } from "react";
import { Copy } from "@/lib/content";
export function MediaUpload({
  t,
  onUpload,
  onBusy,
}: {
  t: Copy;
  onUpload: () => Promise<void>;
  onBusy: (value: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]),
    [dragging, setDragging] = useState(false),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState<string[]>([]);
  const privateInput = useRef<HTMLInputElement>(null),
    picker = useRef<HTMLInputElement>(null);
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onBusy(true);
    setMessages([]);
    const failed: File[] = [];
    try {
      for (const file of files) {
        let message = "";
        if (file.size > 100 * 1024 * 1024) message = t.fileTooLarge;
        else if (!/\.(jpe?g|png|webp|mp4|webm|pdf)$/i.test(file.name))
          message = t.unsupportedMedia;
        else
          try {
            const data = new FormData();
            data.set("file", file);
            data.set("private", String(!!privateInput.current?.checked));
            const response = await fetch("/api/media", {
              method: "POST",
              body: data,
            });
            const result = await response.json();
            if (!response.ok)
              message = t[result.error as keyof Copy] || t.error;
          } catch {
            message = t.error;
          }
        if (message) failed.push(file);
        setMessages((previous) => [
          ...previous,
          `${file.name}: ${message || t.saved}`,
        ]);
      }
      setFiles(failed);
      if (picker.current) picker.current.value = "";
      await onUpload();
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form className="upload-form" onSubmit={upload}>
      <h2>{t.upload}</h2>
      <p>
        {t.uploadHelp} {t.pdfHelp} {t.privateHelp}
      </p>
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) {
            setFiles(Array.from(e.dataTransfer.files));
            setMessages([]);
          }
        }}
      >
        <p>{t.dropFiles}</p>
        <label>
          {t.media}
          <input
            ref={picker}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,application/pdf"
            disabled={busy}
            onChange={(e) => {
              setFiles(Array.from(e.target.files || []));
              setMessages([]);
            }}
          />
        </label>
        {files.length > 0 && (
          <ul>
            {files.map((file, i) => (
              <li key={i}>
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="checkbox-label">
        <input ref={privateInput} type="checkbox" disabled={busy} />
        {t.privateMedia}
      </label>
      <button className="button" disabled={busy || !files.length}>
        {busy ? t.loading : t.upload}
      </button>
      <div role="status" aria-live="polite">
        {messages.map((message, i) => (
          <p key={i}>{message}</p>
        ))}
      </div>
    </form>
  );
}
