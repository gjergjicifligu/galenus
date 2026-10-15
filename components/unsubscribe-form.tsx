"use client";
import { useState } from "react";
import { Copy } from "@/lib/content";
export function UnsubscribeForm({
  t,
  token,
  valid,
}: {
  t: Copy;
  token: string;
  valid: boolean;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <main className="container section">
      <h1>{t.unsubscribe}</h1>
      <p>{valid ? t.unsubscribeIntro : t.invalidLink}</p>
      {valid && !done && (
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await fetch("/api/newsletter/unsubscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
              });
              if (!res.ok) throw new Error();
              setDone(true);
              setMessage(t.unsubscribed);
            } catch {
              setMessage(t.error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t.loading : t.unsubscribe}
        </button>
      )}
      <p role="status">{message}</p>
    </main>
  );
}
