"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import "./sharing.css";
type LinkRow = {
  id: string;
  token: string;
  label: string;
  enabled: boolean;
  expiresAt: string;
};
type Session = {
  id: string;
  label: string;
  ip: string;
  device: string;
  platform: string;
  browser: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  active: boolean;
};
type Event = {
  id: string;
  label: string;
  kind: string;
  resource: string;
  ip: string;
  device: string;
  platform: string;
  browser: string;
  userAgent: string;
  createdAt: string;
  sessionId: string | null;
};
type Data = {
  settings: {
    enabled: boolean;
    hasPassword: boolean;
    sessionHours: number;
    updatedAt: string | null;
  };
  links: LinkRow[];
  sessions: Session[];
  events: Event[];
  nextCursor: string | null;
  blockedIps: { ip: string }[];
};
const time = (s: string) =>
  new Date(s).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function StaffAccessSettings() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(""),
    [enabled, setEnabled] = useState(false),
    [password, setPassword] = useState(""),
    [hours, setHours] = useState(4);
  const [label, setLabel] = useState(""),
    [days, setDays] = useState(7),
    [copied, setCopied] = useState(""),
    [origin, setOrigin] = useState("");
  const [events, setEvents] = useState<Event[]>([]),
    [nextCursor, setNextCursor] = useState<string | null>(null);
  const load = useCallback(async (initial = false, cursor?: string) => {
    const r = await fetch(
      "/api/ops/sharing" +
        (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      { cache: "no-store" },
    );
    const b = await r.json();
    if (!r.ok) throw Error(b.error || "Unable to load staff access");
    setData(b);
    setEvents((previous) => (cursor ? [...previous, ...b.events] : b.events));
    setNextCursor(b.nextCursor);
    if (initial) {
      setEnabled(b.settings.enabled);
      setHours(b.settings.sessionHours);
    }
  }, []);
  useEffect(() => {
    setOrigin(window.location.origin);
    void load(true).catch((e) => setError(e.message));
  }, [load]);
  const command = async (key: string, body: object, message: string) => {
    if (busy) return false;
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/ops/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Unable to save");
      await load();
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
      return false;
    } finally {
      setBusy("");
    }
  };
  const refresh = async (cursor?: string) => {
    if (busy) return;
    setBusy("refresh");
    setError("");
    try {
      await load(!data, cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to refresh");
    } finally {
      setBusy("");
    }
  };
  const copy = async (link: LinkRow) => {
    try {
      await navigator.clipboard.writeText(
        `${origin}/staff/live-ops/${link.token}`,
      );
      setCopied(link.id);
      setTimeout(() => setCopied(""), 2500);
    } catch {
      setError("Select and copy the link from its field.");
    }
  };
  return (
    <div className="share-settings">
      <header className="share-heading">
        <div>
          <p className="admin-kicker">LIVE OPS · CONTROL CENTRE</p>
          <h1 className="admin-title">Staff access</h1>
          <p className="admin-sub">
            Password-protected viewing, individual links and access history.
          </p>
        </div>
        <Link href="/admin/ops" className="admin-btn admin-btn-ghost">
          <ArrowLeft size={16} />
          Back to Live Ops
        </Link>
        <button
          className="admin-btn admin-btn-ghost"
          disabled={!!busy}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
          Refresh access log
        </button>
      </header>
      {error && (
        <div className="share-error" role="alert">
          {error}
          {!data && <button onClick={() => void refresh()}>Try again</button>}
        </div>
      )}
      {notice && (
        <div className="share-notice" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {!data ? (
        <p className="share-loading">
          <Loader2 size={18} className="animate-spin" />
          Loading access settings
        </p>
      ) : (
        <>
          <div className="share-settings-grid">
            <section className="admin-panel share-section">
              <div className="share-section-title">
                <KeyRound size={21} />
                <h2>Password & sessions</h2>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await command(
                      "settings",
                      {
                        action: "settings",
                        enabled,
                        sessionHours: hours,
                        ...(password ? { password } : {}),
                      },
                      "Settings saved. Existing staff sessions have ended.",
                    )
                  )
                    setPassword("");
                }}
              >
                <label className="share-checkbox">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  Enable staff viewing
                </label>
                <label>
                  Staff password
                  <input
                    aria-label="Staff password"
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={72}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      data.settings.hasPassword
                        ? "Leave blank to keep current password"
                        : "Set a password (10+ characters)"
                    }
                    required={!data.settings.hasPassword && enabled}
                  />
                </label>
                <label>
                  Session expires after
                  <select
                    aria-label="Session duration"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  >
                    {[1, 2, 4, 8, 12].map((h) => (
                      <option key={h} value={h}>
                        {h} hour{h > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="share-help">
                  Staff enter the password each time they open the page. Saving
                  settings ends all existing staff sessions. Admin and kiosk
                  passwords are separate.
                </p>
                <button
                  className="admin-btn admin-btn-primary"
                  disabled={!!busy}
                >
                  Save access settings
                </button>
              </form>
              <button
                className="admin-btn admin-btn-ghost share-danger"
                disabled={!!busy}
                onClick={() =>
                  void command(
                    "disconnect",
                    { action: "disconnect-all" },
                    "All existing staff sessions have ended.",
                  )
                }
              >
                Disconnect all staff sessions
              </button>
            </section>
            <section className="admin-panel share-section">
              <div className="share-section-title">
                <Link2 size={21} />
                <h2>Create a staff link</h2>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await command(
                      "new-link",
                      { action: "create-link", label, days },
                      "Staff link created. Copy it below and share the password separately.",
                    )
                  )
                    setLabel("");
                }}
              >
                <label>
                  Staff member or role
                  <input
                    aria-label="Staff member or role"
                    value={label}
                    maxLength={80}
                    placeholder="e.g. Mark · Head coach"
                    onChange={(e) => setLabel(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Link expires after
                  <select
                    aria-label="Link duration"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  >
                    {[1, 7, 14, 30, 90].map((d) => (
                      <option key={d} value={d}>
                        {d} day{d > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="share-help">
                  Use a separate named link for each person. Labels identify the
                  link used, not verified identities. Share only with authorised
                  staff.
                </p>
                <button
                  className="admin-btn admin-btn-primary"
                  disabled={
                    !!busy ||
                    !data.settings.enabled ||
                    !data.settings.hasPassword
                  }
                >
                  Create link
                </button>
              </form>
              {!data.settings.enabled && (
                <p className="share-help">
                  Save an enabled password above to create links.
                </p>
              )}
              <div className="share-security-note">
                <ShieldCheck size={20} />
                <p>
                  Read-only access. PDF, CSV links and editing tools are not
                  provided. A visible session watermark helps identify shared
                  captures; screenshots and copied content cannot be fully
                  prevented. Existing CSV / Power BI URLs remain public and are
                  outside these staff-session controls.
                </p>
              </div>
            </section>
          </div>
          <section className="admin-panel share-section">
            <div className="share-section-title">
              <Link2 size={21} />
              <h2>Staff links</h2>
              <span>{data.links.length} / 100</span>
            </div>
            {!data.links.length && (
              <p className="share-help">No staff links yet.</p>
            )}
            <div className="share-link-list">
              {data.links.map((link) => {
                const active =
                  data.settings.enabled &&
                  link.enabled &&
                  Date.parse(link.expiresAt) > Date.now();
                return (
                  <article key={link.id} className="share-link-row">
                    <div>
                      <strong>{link.label}</strong>
                      <span
                        className={active ? "share-active" : "share-inactive"}
                      >
                        {active
                          ? "Enabled"
                          : !link.enabled
                            ? "Revoked"
                            : Date.parse(link.expiresAt) <= Date.now()
                              ? "Expired"
                              : "Sharing disabled"}
                      </span>
                      <small>Expires {time(link.expiresAt)}</small>
                    </div>
                    <input
                      aria-label={`Link for ${link.label}`}
                      readOnly
                      value={`${origin}/staff/live-ops/${link.token}`}
                      onFocus={(e) => e.target.select()}
                    />
                    <div className="share-actions">
                      <button
                        className="admin-btn admin-btn-ghost"
                        disabled={!active}
                        onClick={() => void copy(link)}
                      >
                        {copied === link.id ? (
                          <Check size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                        {copied === link.id ? "Copied" : "Copy link"}
                      </button>
                      <button
                        className="admin-btn admin-btn-ghost"
                        disabled={!!busy || !active}
                        onClick={() =>
                          void command(
                            link.id,
                            { action: "rotate-link", id: link.id },
                            "Link replaced. The old URL and its sessions no longer work.",
                          )
                        }
                      >
                        Replace URL
                      </button>
                      <button
                        className="admin-btn admin-btn-ghost share-danger"
                        disabled={!!busy || !link.enabled}
                        onClick={() =>
                          void command(
                            link.id,
                            { action: "revoke-link", id: link.id },
                            "Link revoked. Its staff sessions can no longer load data.",
                          )
                        }
                      >
                        <X size={15} />
                        Revoke
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="admin-panel share-section">
            <div className="share-section-title">
              <ShieldCheck size={21} />
              <h2>Recent sessions</h2>
              <span>Latest 100</span>
            </div>
            <p className="share-help">
              Server access ends immediately after revocation. Open pages
              recheck within 15 seconds, on the next data request, and when
              returning to the tab. Device/OS are inferred from the browser; the
              exact model and person are not guaranteed.
            </p>
            <div className="share-scroll">
              <table className="share-audit-table">
                <thead>
                  <tr>
                    <th>Staff link / session</th>
                    <th>IP address</th>
                    <th>Device</th>
                    <th>Opened / last verified</th>
                    <th>Status</th>
                    <th>Control</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sessions.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.label}</strong>
                        <small>{s.id.slice(-8)}</small>
                      </td>
                      <td>
                        <code>{s.ip}</code>
                      </td>
                      <td title={s.userAgent}>
                        {s.platform} · {s.device}
                        <small>{s.browser}</small>
                      </td>
                      <td>
                        {time(s.createdAt)}
                        <small>{time(s.lastSeenAt)}</small>
                      </td>
                      <td>
                        <span
                          className={
                            s.active ? "share-active" : "share-inactive"
                          }
                        >
                          {s.active ? "Active" : "Ended"}
                        </span>
                      </td>
                      <td>
                        <div className="share-actions">
                          <button
                            disabled={!!busy || !s.active}
                            onClick={() =>
                              void command(
                                s.id,
                                { action: "revoke-session", id: s.id },
                                "Staff session revoked.",
                              )
                            }
                          >
                            End session
                          </button>
                          <button
                            disabled={
                              !!busy ||
                              s.ip === "Unavailable" ||
                              data.blockedIps.some((b) => b.ip === s.ip)
                            }
                            onClick={() =>
                              void command(
                                "block-" + s.ip,
                                { action: "block-ip", ip: s.ip },
                                "IP blocked for all staff links. This may affect people on the same network.",
                              )
                            }
                          >
                            Block IP
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.sessions.length && (
              <p className="share-help">No staff sessions recorded.</p>
            )}
            {!!data.blockedIps.length && (
              <div className="share-blocked">
                <strong>Blocked IP addresses</strong>
                {data.blockedIps.map((b) => (
                  <span key={b.ip}>
                    <code>{b.ip}</code>
                    <button
                      disabled={!!busy}
                      onClick={() =>
                        void command(
                          b.ip,
                          { action: "unblock-ip", ip: b.ip },
                          "IP unblocked.",
                        )
                      }
                    >
                      Unblock
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
          <section className="admin-panel share-section">
            <div className="share-section-title">
              <ActivityIcon />
              <h2>Access journal</h2>
              <span>90-day retention · Loaded on refresh</span>
            </div>
            <p className="share-help">
              Successful and failed password checks, data views and admin access
              changes. IP identifies a network connection; VPNs and shared
              networks can mask or share it. No player answers or passwords are
              stored in this journal.
            </p>
            <div className="share-scroll">
              <table className="share-audit-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Staff link</th>
                    <th>Event / resource</th>
                    <th>IP address</th>
                    <th>Device / browser</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td>{time(e.createdAt)}</td>
                      <td>
                        <strong>{e.label}</strong>
                        {e.sessionId && <small>{e.sessionId.slice(-8)}</small>}
                      </td>
                      <td>
                        {e.kind.replaceAll("_", " ")}
                        <small className="share-resource">{e.resource}</small>
                      </td>
                      <td>
                        <code>{e.ip}</code>
                      </td>
                      <td title={e.userAgent}>
                        {e.platform} · {e.device}
                        <small>{e.browser}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor && (
              <button
                className="admin-btn admin-btn-ghost"
                disabled={!!busy}
                onClick={() => void refresh(nextCursor)}
              >
                Load older events
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
function ActivityIcon() {
  return <ShieldCheck size={21} />;
}
