"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  KeyRound,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { OpsAccessContext, useOpsAccess } from "./OpsAccess";
import OpsMonitoringHub, {
  type OpsTab,
} from "@/components/admin/ops/OpsMonitoringHub";
import OpsIndividual from "@/components/admin/ops/OpsIndividual";
import OpsWellnessTable from "@/components/admin/ops/OpsWellnessTable";
import OpsBodyMapsSection from "@/components/admin/ops/OpsBodyMapsSection";
import WellnessFlipCard, {
  type OpsPlayerCard,
} from "@/components/admin/ops/WellnessFlipCard";
import {
  DEFAULT_OPS_COLUMNS,
  type OpsColumnConfig,
} from "@/lib/opsTableColumns";
import type { TeamWellnessSummary } from "@/lib/opsWellness";
import "@/app/admin/admin.css";
import "@/app/admin/ops/ops-wellness.css";
import "./sharing.css";

type Viewer = {
  label: string;
  expiresAt: string;
  sessionTag: string;
  ip: string;
};
type Day = {
  team: { name: string };
  survey: { id: string; title: string } | null;
  surveys: { id: string; title: string; isActive: boolean }[];
  selectedDate: string;
  generatedAt: string;
  players: OpsPlayerCard[];
  stats: { total: number; done: number; pending: number };
  wellnessSummary: TeamWellnessSummary;
  metrics?: {
    key: string;
    name: string;
    enabled: boolean;
    showInTable: boolean;
  }[];
};
function Dashboard() {
  const { apiBase, request } = useOpsAccess();
  const [day, setDay] = useState<Day | null>(null),
    [date, setDate] = useState(""),
    [surveyId, setSurveyId] = useState("");
  const [tab, setTab] = useState<OpsTab>("daily"),
    [search, setSearch] = useState(""),
    [mode, setMode] = useState<"table" | "cards">("table");
  const [filter, setFilter] = useState("all"),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true);
  const [columns, setColumns] =
    useState<OpsColumnConfig[]>(DEFAULT_OPS_COLUMNS);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) setRefresh((x) => x + 1);
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);
  const seq = useRef(0);
  useEffect(() => {
    const ac = new AbortController(),
      n = ++seq.current;
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    if (surveyId) query.set("surveyId", surveyId);
    void request(`${apiBase}/today?${query}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error || "Unable to load Live Ops");
        if (n === seq.current) setDay(body);
      })
      .catch((e) => {
        if (e.name !== "AbortError" && n === seq.current) setError(e.message);
      })
      .finally(() => {
        if (n === seq.current) setLoading(false);
      });
    return () => ac.abort();
  }, [apiBase, request, date, surveyId, refresh]);
  const sid = surveyId || day?.survey?.id || "";
  useEffect(() => {
    if (!sid) return;
    const ac = new AbortController();
    setColumns(DEFAULT_OPS_COLUMNS);
    void request(
      `${apiBase}/table-preferences?surveyId=${encodeURIComponent(sid)}`,
      { cache: "no-store", signal: ac.signal },
    )
      .then(async (r) => {
        if (r.ok) {
          const b = await r.json();
          if (Array.isArray(b.columns)) setColumns(b.columns);
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, [apiBase, request, sid]);
  const current =
    !!day &&
    (!date || day.selectedDate === date) &&
    (!surveyId || day.survey?.id === surveyId);
  const rows = (day?.players || [])
    .filter((p) =>
      `${p.firstName} ${p.lastName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    )
    .filter((p) => filter === "all" || p.status === filter);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const ws = day?.wellnessSummary;
  return (
    <div className="share-dashboard">
      <header className="share-heading">
        <div>
          <p className="admin-kicker">TEAM MONITORING · READ ONLY</p>
          <h1 className="admin-title">Live Ops</h1>
          <p className="admin-sub">{day?.team.name || "Staff dashboard"}</p>
        </div>
        <button
          className="admin-btn admin-btn-ghost"
          disabled={loading}
          onClick={() => setRefresh((x) => x + 1)}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>
      <section className="admin-panel share-filters">
        <label>
          Survey
          <select
            aria-label="Survey"
            value={sid}
            onChange={(e) => {
              setSurveyId(e.target.value);
              setSearch("");
            }}
          >
            {day?.surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            aria-label="Monitoring date"
            type="date"
            max={today}
            value={date || day?.selectedDate || ""}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <span>
          {day
            ? `${day.stats.done}/${day.stats.total} submitted`
            : "Loading team data"}
        </span>
      </section>
      {error && (
        <div className="share-error" role="alert">
          {error}
          <button onClick={() => setRefresh((x) => x + 1)}>Try again</button>
        </div>
      )}
      {loading && (
        <p role="status" className="share-loading">
          Loading Live Ops
        </p>
      )}
      {current && day?.survey && (
        <div className="sg7-page">
          <OpsMonitoringHub
            survey={day.survey}
            date={day.selectedDate}
            refreshKey={day.generatedAt}
            tab={tab}
            onTab={setTab}
            search={search}
            onSearch={setSearch}
          />
          {tab === "individual" && (
            <OpsIndividual
              key={sid}
              surveyId={sid}
              endDate={day.selectedDate}
            />
          )}
          {tab === "daily" && (
            <>
              {ws && (
                <div className="sg7-summary">
                  <div className="sg7-readiness">
                    <small>Squad readiness</small>
                    <strong style={{ color: ws.teamReadinessColor }}>
                      {ws.teamReadinessPct == null
                        ? "—"
                        : `${ws.teamReadinessPct}%`}
                    </strong>
                  </div>
                  <div>
                    <small>Alert</small>
                    <strong style={{ color: "#ef4444" }}>
                      {ws.alertCount}
                    </strong>
                    <span>require attention</span>
                  </div>
                  <div>
                    <small>Watch</small>
                    <strong style={{ color: "#facc15" }}>
                      {ws.watchCount}
                    </strong>
                    <span>to monitor</span>
                  </div>
                  <div>
                    <small>Ready</small>
                    <strong style={{ color: "#22c55e" }}>
                      {ws.readyCount}
                    </strong>
                    <span>good to go</span>
                  </div>
                  <div>
                    <small>Fatigue ↓</small>
                    <strong style={{ color: ws.teamFatigueDeltaColor }}>
                      {ws.fatigueUpCount}
                    </strong>
                    <span>team Δ {ws.teamFatigueDeltaText}</span>
                  </div>
                </div>
              )}
              <div className="share-table-toolbar">
                <h2>
                  <Activity size={18} />
                  Daily monitoring
                </h2>
                <div
                  className="ops-view-switch"
                  role="group"
                  aria-label="View mode"
                >
                  {(["table", "cards"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setMode(v)}
                      className={mode === v ? "is-on" : ""}
                    >
                      {v === "table" ? "Table" : "Cards"}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="Submission filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All ({day.stats.total})</option>
                  <option value="done">Done ({day.stats.done})</option>
                  <option value="pending">Pending ({day.stats.pending})</option>
                </select>
              </div>
              {!rows.length ? (
                <div className="share-empty">
                  <Users size={26} />
                  <p>No matching players</p>
                </div>
              ) : mode === "table" ? (
                <>
                  <OpsWellnessTable
                    players={rows}
                    columns={columns}
                    metricColumns={day.metrics?.filter(
                      (m) => m.enabled && m.showInTable,
                    )}
                  />
                  <OpsBodyMapsSection players={rows} />
                </>
              ) : (
                <div className="sg7-grid">
                  {rows.map((p) => (
                    <WellnessFlipCard key={p.id} player={p} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {day && !day.survey && (
        <div className="share-empty">No surveys available for this team.</div>
      )}
    </div>
  );
}
export default function SharedLiveOps({ token }: { token: string }) {
  const apiBase = `/api/live-ops-share/${encodeURIComponent(token)}`;
  const [viewer, setViewer] = useState<Viewer | null>(null),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [suspended, setSuspended] = useState(false);
  const alive = useRef(true),
    epoch = useRef(0),
    expiry = useRef(0);
  const lock = useCallback((message: string) => {
    epoch.current++;
    setViewer(null);
    setPassword("");
    setSuspended(false);
    setError(message);
  }, []);
  const request: typeof fetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = await fetch(input, {
        ...init,
        cache: "no-store",
        credentials: "same-origin",
      });
      if (r.status === 401 || r.status === 403)
        lock("Access ended. Enter the password again or contact your coach.");
      return r;
    },
    [lock],
  );
  const access = useMemo(
    () => ({ readOnly: true, apiBase, request }),
    [apiBase, request],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!viewer) return;
    expiry.current = Date.parse(viewer.expiresAt);
    const check = async () => {
      const e = epoch.current;
      try {
        const response = await fetch(`${apiBase}/status`, {
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok)
          throw Error(
            "Access ended. Enter the password again or contact your coach.",
          );
        const body = await response.json();
        if (e === epoch.current && alive.current) {
          setViewer(body);
          setSuspended(false);
        }
      } catch {
        if (e === epoch.current && alive.current)
          lock(
            "Unable to verify access. Enter the password again when connected.",
          );
      }
    };
    const timer = window.setInterval(() => {
      if (Date.now() >= expiry.current)
        lock("Your session has expired. Enter the password again.");
      else if (!document.hidden) void check();
    }, 15000);
    const visibility = () => {
      if (document.hidden) setSuspended(true);
      else void check();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) lock("Enter the password to reopen Live Ops.");
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", pageshow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", pageshow);
    };
    // Session identity stays fixed; the heartbeat only refreshes its metadata.
  }, [viewer?.sessionTag, apiBase, lock]); // eslint-disable-line react-hooks/exhaustive-deps
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          tablet:
            /Macintosh/.test(navigator.userAgent) &&
            navigator.maxTouchPoints > 1,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error || "Access unavailable");
      if (alive.current) {
        setViewer(body);
        setPassword("");
        setSuspended(false);
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Unable to connect");
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const logout = () => {
    lock("");
    void fetch(`${apiBase}/logout`, { method: "POST", keepalive: true }).catch(
      () => {},
    );
  };
  return (
    <main className="admin-shell share-shell">
      {!viewer ? (
        <section className="share-gate">
          <div className="share-gate-icon">
            <LockKeyhole size={28} />
          </div>
          <p className="admin-kicker">WELLNESS MONITOR</p>
          <h1>Staff access</h1>
          <p>Enter the password provided by your coach.</p>
          <form onSubmit={login}>
            <label htmlFor="staff-password">Password</label>
            <div className="share-password">
              <KeyRound size={18} />
              <input
                id="staff-password"
                type="password"
                autoComplete="off"
                value={password}
                maxLength={72}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="share-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="admin-btn admin-btn-primary"
              disabled={busy || !password}
            >
              {busy ? "Opening Live Ops" : "Open Live Ops"}
            </button>
          </form>
          <p className="share-disclosure">
            <ShieldCheck size={16} />
            Viewing only. Access is logged with your IP address and
            browser/device information. Forwarding this link or password is not
            authorised.
          </p>
        </section>
      ) : (
        <>
          <div className="share-access-bar">
            <div>
              <ShieldCheck size={18} />
              <strong>{viewer.label}</strong>
              <span>Read only · Access logged</span>
            </div>
            <button onClick={logout}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
          <div className="share-watermark" aria-hidden>
            {viewer.label} · {viewer.ip} · {viewer.sessionTag}
          </div>
          {suspended && (
            <div className="share-verifying" role="status">
              Verifying access
            </div>
          )}
          <div style={{ visibility: suspended ? "hidden" : "visible" }}>
            <OpsAccessContext.Provider value={access}>
              <Dashboard />
            </OpsAccessContext.Provider>
          </div>
          <footer className="share-footer">
            {viewer.label} · Session {viewer.sessionTag} · IP {viewer.ip} ·
            Expires{" "}
            {new Date(viewer.expiresAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </footer>
        </>
      )}
    </main>
  );
}
