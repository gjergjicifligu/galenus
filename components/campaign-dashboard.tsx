"use client";
import { useEffect, useState } from "react";
import { Copy, Lang, RecordData, localized } from "@/lib/content";
type Subscriber = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  language: string;
  status: string;
};
type Recipient = Subscriber & {
  subscriber: string;
  attempts: number;
  sent_at: string | null;
  error: string | null;
};
type Detail = {
  id: string;
  name: string;
  subject_sq: string;
  subject_en: string;
  intro_sq: string;
  intro_en: string;
  modules: RecordData[];
  revision: string;
  started_at: string | null;
  recipients: Recipient[];
  tests: {
    id: string;
    email: string;
    language: string;
    status: string;
    created_at: string;
    error: string | null;
  }[];
  previews: { sq: { html: string }; en: { html: string } };
};
const blank = {
  name: "",
  subject_sq: "",
  subject_en: "",
  intro_sq: "",
  intro_en: "",
};
export function CampaignDashboard({ t, lang }: { t: Copy; lang: Lang }) {
  const [modules, setModules] = useState<RecordData[]>([]),
    [subscribers, setSubscribers] = useState<Subscriber[]>([]),
    [history, setHistory] = useState<
      { id: string; name: string; created_at: string }[]
    >([]),
    [configured, setConfigured] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]),
    [selectedSubscribers, setSelectedSubscribers] = useState<string[]>([]),
    [fields, setFields] = useState(blank),
    [moduleQuery, setModuleQuery] = useState(""),
    [subscriberQuery, setSubscriberQuery] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [dirty, setDirty] = useState(true),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [previewLanguage, setPreviewLanguage] = useState<Lang>(lang),
    [testAddress, setTestAddress] = useState("");
  const tr = (key: string) =>
    key === "pending" ? t.deliveryPending : t[key as keyof Copy] || key;
  async function api(url: string, data?: unknown) {
    const response = await fetch(
      `/api/${url}`,
      data
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        : undefined,
    );
    const result = await response.json();
    if (!response.ok) throw new Error(tr(result.error || "error"));
    return result;
  }
  async function refresh() {
    const [campaigns, items, people] = await Promise.all([
      api("campaigns"),
      api("modules"),
      api("newsletter/subscribers"),
    ]);
    setHistory(campaigns.campaigns);
    setConfigured(campaigns.smtpConfigured);
    setModules(items.filter((r: RecordData) => r.published));
    setSubscribers(people);
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api("campaigns"),
      api("modules"),
      api("newsletter/subscribers"),
    ])
      .then(([c, m, s]) => {
        if (active) {
          setHistory(c.campaigns);
          setConfigured(c.smtpConfigured);
          setModules(m.filter((r: RecordData) => r.published));
          setSubscribers(s);
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const locked = !!detail?.started_at;
  const edit = () => {
    setDirty(true);
    setConfirm(false);
    setMessage("");
  };
  const moduleList = modules.filter((m) =>
    (localized(m, "title", lang) + " " + localized(m, "description", lang))
      .toLowerCase()
      .includes(moduleQuery.toLowerCase()),
  );
  const subscriberList = subscribers.filter(
    (s) =>
      s.status === "active" &&
      `${s.first_name} ${s.last_name} ${s.email}`
        .toLowerCase()
        .includes(subscriberQuery.toLowerCase()),
  );
  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api("campaigns", {
        ...fields,
        ...(detail ? { id: detail.id } : {}),
        modules: selectedModules,
        subscribers: selectedSubscribers,
      });
      setDetail(await api(`campaigns/${result.id}`));
      setDirty(false);
      setConfirm(false);
      await refresh();
      setMessage(t.saved);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const c = (await api(`campaigns/${id}`)) as Detail;
      setDetail(c);
      setFields({
        name: c.name,
        subject_sq: c.subject_sq,
        subject_en: c.subject_en,
        intro_sq: c.intro_sq,
        intro_en: c.intro_en,
      });
      setSelectedModules(c.modules.map((m) => m.id));
      setSelectedSubscribers(c.recipients.map((r) => r.subscriber));
      setDirty(false);
      setConfirm(false);
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send(retry = false) {
    if (!detail || !confirm || dirty) return;
    setBusy(true);
    setMessage("");
    try {
      let result = (await api(`campaigns/${detail.id}/send`, {
        confirm: true,
        revision: detail.revision,
        retry,
      })) as Detail;
      setDetail(result);
      while (result.recipients.some((r) => r.status === "pending")) {
        result = await api(`campaigns/${detail.id}/send`, {
          confirm: true,
          revision: detail.revision,
          retry: false,
        });
        setDetail(result);
      }
      await refresh();
      setMessage(t.sendResult);
      setConfirm(false);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p aria-busy="true">{t.loading}</p>;
  return (
    <div className="campaign-dashboard">
      <p className="notice">{t.selectionHelp}</p>
      {!configured && <p className="notice">{t.smtpMissing}</p>}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div className="campaign-toolbar">
        <button
          className="outline-button"
          disabled={busy}
          onClick={() => {
            setDetail(null);
            setFields(blank);
            setSelectedModules([]);
            setSelectedSubscribers([]);
            edit();
          }}
        >
          {t.newCampaign}
        </button>
        <label>
          {t.campaignHistory}
          <select
            aria-label={t.campaignHistory}
            value={detail?.id || ""}
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) void open(e.target.value);
            }}
          >
            <option value="">{t.chooseCampaign}</option>
            {history.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.created_at.slice(0, 10)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form onSubmit={save}>
        <fieldset disabled={busy || locked} className="editor-fields">
          <label>
            {t.campaignName}
            <input
              value={fields.name}
              required
              maxLength={200}
              onChange={(e) => {
                setFields({ ...fields, name: e.target.value });
                edit();
              }}
            />
          </label>
          <div className="bilingual-fields">
            {(["sq", "en"] as const).map((l) => (
              <fieldset key={l}>
                <legend>{l === "sq" ? "Shqip" : "English"}</legend>
                <label>
                  {t.subject}
                  <input
                    value={fields[`subject_${l}`]}
                    required={l === "sq"}
                    maxLength={200}
                    onChange={(e) => {
                      setFields({
                        ...fields,
                        [`subject_${l}`]: e.target.value,
                      });
                      edit();
                    }}
                  />
                </label>
                <label>
                  {t.emailIntro}
                  <textarea
                    value={fields[`intro_${l}`]}
                    maxLength={5000}
                    onChange={(e) => {
                      setFields({ ...fields, [`intro_${l}`]: e.target.value });
                      edit();
                    }}
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <section className="campaign-module-selection">
            <h3>
              {t.modules} · {t.selected}: {selectedModules.length}
            </h3>
            <label>
              {t.search}
              <input
                value={moduleQuery}
                onChange={(e) => setModuleQuery(e.target.value)}
              />
            </label>
            <div className="selection-actions">
              <button
                type="button"
                className="outline-button small"
                onClick={() => {
                  setSelectedModules([
                    ...new Set([
                      ...selectedModules,
                      ...moduleList.map((m) => m.id),
                    ]),
                  ]);
                  edit();
                }}
              >
                {t.selectAll}
              </button>
              <button
                type="button"
                className="outline-button small"
                onClick={() => {
                  setSelectedModules([]);
                  edit();
                }}
              >
                {t.clearSelection}
              </button>
            </div>
            <div className="campaign-module-grid">
              {moduleList.map((m) => (
                <label className="campaign-module-option" key={m.id}>
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(m.id)}
                    onChange={() => {
                      setSelectedModules(toggle(selectedModules, m.id));
                      edit();
                    }}
                  />
                  {m.thumbnail && (
                    <img src={`/api/media/${m.thumbnail}`} alt="" />
                  )}
                  <span>
                    <strong>
                      {localized(m, "title", lang) ||
                        localized(m, "title", "sq")}
                    </strong>
                    <small>
                      {(
                        localized(m, "description", lang) ||
                        localized(m, "description", "sq")
                      ).slice(0, 160)}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className="campaign-subscriber-selection">
            <h3>
              {t.subscribers} · {t.selected}: {selectedSubscribers.length}
            </h3>
            <label>
              {t.search}
              <input
                value={subscriberQuery}
                onChange={(e) => setSubscriberQuery(e.target.value)}
              />
            </label>
            <div className="selection-actions">
              <button
                type="button"
                className="outline-button small"
                onClick={() => {
                  setSelectedSubscribers([
                    ...new Set([
                      ...selectedSubscribers,
                      ...subscriberList.map((s) => s.id),
                    ]),
                  ]);
                  edit();
                }}
              >
                {t.selectAll}
              </button>
              <button
                type="button"
                className="outline-button small"
                onClick={() => {
                  setSelectedSubscribers([]);
                  edit();
                }}
              >
                {t.clearSelection}
              </button>
            </div>
            <div className="subscriber-options">
              {subscriberList.map((s) => (
                <label className="checkbox-label" key={s.id}>
                  <input
                    type="checkbox"
                    checked={selectedSubscribers.includes(s.id)}
                    onChange={() => {
                      setSelectedSubscribers(toggle(selectedSubscribers, s.id));
                      edit();
                    }}
                  />
                  <span>
                    {s.first_name} {s.last_name} · {s.email} ·{" "}
                    {s.language.toUpperCase()}
                  </span>
                </label>
              ))}
              {!subscriberList.length && <p>{t.noActiveSubscribers}</p>}
            </div>
          </section>
        </fieldset>
        {!locked && (
          <button
            className="button"
            disabled={
              busy || !selectedModules.length || !selectedSubscribers.length
            }
          >
            {busy ? t.loading : t.saveCampaign}
          </button>
        )}
        {locked && <p className="notice">{t.campaignLocked}</p>}
      </form>
      {detail && !dirty && (
        <section className="campaign-preview">
          <h2>{t.previewEmail}</h2>
          <label>
            {t.language}
            <select
              aria-label={t.language}
              value={previewLanguage}
              onChange={(e) => setPreviewLanguage(e.target.value as Lang)}
            >
              <option value="sq">Shqip</option>
              <option value="en">English</option>
            </select>
          </label>
          <p>
            {t.subscribers}: {detail.recipients.length} · {t.modules}:{" "}
            {detail.modules.length}
          </p>
          <iframe
            title={t.previewEmail}
            sandbox=""
            srcDoc={detail.previews[previewLanguage].html}
          />
          <p>{t.testHelp}</p>
          <form
            className="test-email-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                await api(`campaigns/${detail.id}/test`, {
                  email: testAddress,
                  language: previewLanguage,
                });
                setDetail(await api(`campaigns/${detail.id}`));
                setMessage(t.testSent);
              } catch (error) {
                setMessage((error as Error).message);
                setDetail(await api(`campaigns/${detail.id}`));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t.testAddress}
              <input
                type="email"
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                required
                maxLength={254}
              />
            </label>
            <button className="outline-button" disabled={busy}>
              {t.testEmail}
            </button>
          </form>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirm}
              disabled={busy}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            <span>{t.confirmSend}</span>
          </label>
          <div className="selection-actions">
            <button
              className="button"
              disabled={
                busy ||
                !confirm ||
                !detail.recipients.some((r) => r.status === "pending")
              }
              onClick={() => void send()}
            >
              {busy ? t.loading : t.sendCampaign}
            </button>
            <button
              className="outline-button"
              disabled={
                busy ||
                !confirm ||
                !detail.recipients.some((r) => r.status === "failed")
              }
              onClick={() => void send(true)}
            >
              {t.retryFailed}
            </button>
          </div>
          <p>{t.deliveryHelp}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.name}</th>
                  <th>{t.email}</th>
                  <th>{t.status}</th>
                  <th>{t.attempts}</th>
                  <th>{t.sentAt}</th>
                </tr>
              </thead>
              <tbody>
                {detail.recipients.map((r) => (
                  <tr key={r.subscriber}>
                    <td>
                      {r.first_name} {r.last_name}
                    </td>
                    <td>{r.email}</td>
                    <td>
                      {tr(r.status)}
                      {r.error && <small>{r.error}</small>}
                    </td>
                    <td>{r.attempts}</td>
                    <td>{r.sent_at || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!!detail.tests.length && (
            <>
              <h3>{t.testHistory}</h3>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {detail.tests.map((test) => (
                      <tr key={test.id}>
                        <td>{test.email}</td>
                        <td>{test.language}</td>
                        <td>{tr(test.status)}</td>
                        <td>{test.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
      <details>
        <summary>{t.unsubscribedStatus}</summary>
        {subscribers
          .filter((s) => s.status !== "active")
          .map((s) => (
            <p key={s.id}>
              {s.first_name} {s.last_name} · {s.email}
            </p>
          ))}
      </details>
    </div>
  );
}
