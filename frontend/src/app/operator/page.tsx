"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { AuditEvent, SessionDetail, TranscriptSegment } from "@/types";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
type Tab = "overview" | "profile" | "offers" | "transcript" | "audit";

export default function OperatorPage() {
  const [sessionId, setSessionId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionDetail | null>(null);
  const [audit, setAudit] = useState<AuditEvent[] | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = sessionId.trim();
    if (!id) {
      setError("Enter a session ID");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [s, a, t] = await Promise.all([
        api.getSession(id),
        api.getAudit(id),
        api.getTranscript(id),
      ]);
      setData(s);
      setAudit(a);
      setTranscript(t);
      setTab("overview");
    } catch (e: unknown) {
      setData(null);
      setAudit(null);
      setTranscript(null);
      setError(e instanceof Error ? e.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "profile" as const, label: "Profile & risk" },
        { id: "offers" as const, label: "Offers" },
        { id: "transcript" as const, label: "Transcript" },
        { id: "audit" as const, label: "Audit" },
      ] as const,
    []
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Operator console
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Inspect session state, underwriting outputs, and the append-only audit
          trail.
        </p>
      </div>

      <Card padding="md" className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Session UUID"
            className="input-base flex-1 font-mono text-sm"
            spellCheck={false}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <Button onClick={load} loading={loading} className="shrink-0">
            Load session
          </Button>
        </div>
      </Card>

      {error && (
        <Card
          padding="md"
          className="mb-6 border-danger-200 bg-danger-50/60 text-danger-800"
        >
          {error}
        </Card>
      )}

      {data && (
        <>
          <div className="mb-4 flex flex-wrap gap-1 border-b border-surface-200 pb-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`tab-btn ${tab === t.id ? "tab-btn-active" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && <OverviewTab data={data} />}
          {tab === "profile" && <ProfileTab data={data} />}
          {tab === "offers" && <OffersTab data={data} />}
          {tab === "transcript" && (
            <TranscriptTab segments={transcript || []} />
          )}
          {tab === "audit" && <AuditTab events={audit || []} />}
        </>
      )}

      {!data && !error && !loading && (
        <Card padding="lg" className="text-center text-slate-500">
          <p className="text-sm">
            Paste a session ID from the onboarding flow (browser URL or API
            response) and click{" "}
            <span className="font-medium text-slate-700">Load session</span>.
          </p>
        </Card>
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: SessionDetail }) {
  const d = data.decision;
  return (
    <div className="grid gap-4 lg:grid-cols-2 animate-fade-in">
      <Card padding="md">
        <CardHeader title="Session" />
        <dl className="space-y-2 text-sm">
          <Row label="ID" value={<span className="font-mono text-xs">{data.id}</span>} />
          <Row label="Status" value={<Badge variant="brand">{data.status}</Badge>} />
          <Row label="Campaign" value={data.campaign_id} />
          <Row label="Channel" value={data.channel} />
          <Row
            label="Geo"
            value={
              data.geo?.lat != null && data.geo?.lon != null
                ? `${data.geo.lat.toFixed(4)}, ${data.geo.lon.toFixed(4)}`
                : "—"
            }
          />
        </dl>
      </Card>
      <Card padding="md">
        <CardHeader title="Decision" />
        {d ? (
          <dl className="space-y-2 text-sm">
            <Row
              label="Outcome"
              value={
                <Badge
                  variant={
                    d.outcome === "approved"
                      ? "success"
                      : d.outcome === "manual_review"
                        ? "warning"
                        : "danger"
                  }
                >
                  {d.outcome}
                </Badge>
              }
            />
            <Row label="Risk band" value={d.risk_band} />
            <Row label="Explanation" value={d.explanation} wide />
          </dl>
        ) : (
          <p className="text-sm text-slate-500">No decision recorded yet.</p>
        )}
      </Card>
    </div>
  );
}

function ProfileTab({ data }: { data: SessionDetail }) {
  const p = data.extracted_profile;
  const r = data.risk_assessment;
  const b = data.bureau_snapshot;
  const age = data.age_estimation;
  const live = data.liveness_result;

  return (
    <div className="grid gap-4 lg:grid-cols-2 animate-fade-in">
      <Card padding="md">
        <CardHeader title="Extracted profile (LLM)" />
        {!p ? (
          <p className="text-sm text-slate-500">No profile extracted.</p>
        ) : (
          <dl className="space-y-2 text-sm">
            <Row label="Name" value={p.full_name || "—"} />
            <Row label="Age" value={p.declared_age?.toString() || "—"} />
            <Row label="Employment" value={p.employment_type || "—"} />
            <Row
              label="Income / mo"
              value={
                p.monthly_income != null
                  ? `₹${p.monthly_income.toLocaleString("en-IN")}`
                  : "—"
              }
            />
            <Row
              label="Loan ask"
              value={
                p.loan_amount_requested != null
                  ? `₹${p.loan_amount_requested.toLocaleString("en-IN")}`
                  : "—"
              }
            />
            <Row label="Purpose" value={p.loan_purpose || "—"} />
          </dl>
        )}
      </Card>
      <Card padding="md">
        <CardHeader title="Risk & bureau" />
        {!r && !b ? (
          <p className="text-sm text-slate-500">No risk data.</p>
        ) : (
          <dl className="space-y-2 text-sm">
            {r && (
              <>
                <Row label="Risk score" value={r.risk_score?.toFixed(3) || "—"} />
                <Row label="Band" value={r.risk_band} />
                <Row
                  label="Propensity"
                  value={r.propensity_score?.toFixed(3) || "—"}
                />
              </>
            )}
            {b && (
              <>
                <Row label="CIBIL (synth)" value={b.cibil_score?.toString() || "—"} />
                <Row label="Active loans" value={String(b.active_loans)} />
                <Row label="Overdue" value={String(b.overdue_count)} />
              </>
            )}
          </dl>
        )}
      </Card>
      <Card padding="md" className="lg:col-span-2">
        <CardHeader title="Vision" />
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Age estimation
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-50 p-3 font-mono text-xs">
              {age ? JSON.stringify(age, null, 2) : "—"}
            </pre>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Liveness
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-50 p-3 font-mono text-xs">
              {live ? JSON.stringify(live, null, 2) : "—"}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}

function OffersTab({ data }: { data: SessionDetail }) {
  const offers = data.offers || [];
  return (
    <div className="animate-fade-in">
      {offers.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-slate-500">No offers on file.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => (
            <Card key={o.offer_ref || o.offer_id} padding="md" hover>
              <p className="font-mono text-[10px] text-slate-400">
                {o.offer_ref || o.offer_id}
              </p>
              <p className="mt-1 text-xl font-bold text-brand-700">
                ₹{(o.principal_amount ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="text-sm text-slate-600">
                {(o as { tenure_months?: number }).tenure_months ?? "—"} mo ·{" "}
                {(o as { interest_rate_pa?: number }).interest_rate_pa ?? "—"}%
                p.a.
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TranscriptTab({ segments }: { segments: TranscriptSegment[] }) {
  return (
    <Card padding="none" className="animate-fade-in overflow-hidden">
      <div className="max-h-[560px] overflow-y-auto p-4">
        {segments.length === 0 ? (
          <p className="text-sm text-slate-500">No transcript segments.</p>
        ) : (
          <ol className="space-y-3 text-sm">
            {segments.map((t, i) => (
              <li key={`${t.start}-${i}`} className="border-l-2 border-brand-200 pl-3">
                <span className="font-mono text-xs text-slate-400">
                  {t.start.toFixed(1)}–{t.end.toFixed(1)}s
                </span>
                <p className="mt-0.5 text-slate-800">{t.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

function AuditTab({ events }: { events: AuditEvent[] }) {
  return (
    <Card padding="none" className="animate-fade-in overflow-hidden">
      <div className="max-h-[560px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No audit events.</p>
        ) : (
          <ul className="divide-y divide-surface-200">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-3 text-sm">
                <div className="w-24 shrink-0 font-mono text-xs text-slate-400">
                  {new Date(e.created_at).toLocaleTimeString()}
                </div>
                <div className="min-w-0 flex-1">
                  <Badge variant="neutral" className="mb-1 font-mono text-[10px]">
                    {e.event_type}
                  </Badge>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-slate-600">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  wide,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4 ${wide ? "" : ""}`}
    >
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd
        className={`font-medium text-slate-900 sm:text-right ${wide ? "whitespace-pre-wrap text-left sm:max-w-md" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
