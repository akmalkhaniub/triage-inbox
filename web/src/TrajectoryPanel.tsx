import { useEffect, useState } from "react";
import { loadTrajectory } from "./data";
import AgentGraph from "./AgentGraph";
import type { CaseMeta, ManifestEntry, CaseRow, Trajectory, TrajStep } from "./types";

const ROLE: Record<string, string> = {
  router: "Classification & Orchestration",
  changelog_auditor: "Specialist G (CHANGELOG)",
  review_resolver: "Specialist E (PR Reviews)",
  verifier: "Two-Layer Grounding & Soundness Verifier",
  baseline: "Flat Single-Prompt Baseline",
};

function GroundTruth({ meta }: { meta: CaseMeta }) {
  const gt = meta.ground_truth;
  if (meta.item_type === "changelog_audit" && Array.isArray(gt)) {
    if (gt.length === 0)
      return <p className="finding" style={{ margin: 0 }}><span className="ok-check">✓</span> Clean release — no discrepancies exist.</p>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {gt.map((d: { type: string; ref: string }, i) => (
          <div className="finding" key={i} style={{ margin: 0 }}>
            <span className={`vlabel ${d.type}`}>{d.type.toUpperCase()}</span> <code>{d.ref}</code>
          </div>
        ))}
      </div>
    );
  }
  if (meta.item_type === "review_resolution" && gt && typeof gt === "object") {
    const entries = Object.entries(gt as Record<string, string>);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(([cid, v]) => (
          <div className="finding" key={cid} style={{ margin: 0 }}>
            <code>{cid}</code> → <span className={`vlabel ${v}`}>{v.toUpperCase()}</span>
          </div>
        ))}
      </div>
    );
  }
  return <p className="finding" style={{ margin: 0 }}>—</p>;
}

function StepView({ s }: { s: TrajStep }) {
  if (s.kind === "model") {
    return (
      <div className="step">
        <div className="s-kind">Model Turn {s.step} · {s.stop_reason}</div>
        {(s.content || []).map((b, i) => {
          if (b.type === "text" && b.text?.trim())
            return <div className="s-text" key={i}>{b.text.trim()}</div>;
          if (b.type === "tool_use")
            return (
              <div className="toolcall" key={i}>
                <strong>🔧 Tool Call:</strong> <span className="tc-name">{b.name}</span>({JSON.stringify(b.input)})
              </div>
            );
          return null;
        })}
      </div>
    );
  }
  return (
    <div className="step">
      <div className="s-kind">
        <span className="pill-tool">📦 Tool Output: {s.name}</span> {s.is_error ? "(error)" : ""}
      </div>
      <div className={`toolresult${s.is_error ? " err" : ""}`}>{s.result}</div>
    </div>
  );
}

function AgentTraj({ entry }: { entry: ManifestEntry }) {
  const [traj, setTraj] = useState<Trajectory | null>(null);
  useEffect(() => {
    let live = true;
    loadTrajectory(entry.file).then((t) => live && setTraj(t)).catch(() => {});
    return () => { live = false; };
  }, [entry.file]);

  return (
    <div className="traj-agent">
      <div className="ta-head">
        <span className="ta-name">{entry.agent}</span>
        <span className="ta-role">{ROLE[entry.agent] || "Agent"}</span>
        <span className="ta-meta">{entry.steps} steps · {entry.in + entry.out} tokens</span>
      </div>
      {traj ? traj.steps.map((s, i) => <StepView key={i} s={s} />)
            : <div className="step s-text" style={{ color: "var(--text-faint)" }}>Loading trajectory steps…</div>}
    </div>
  );
}

export default function TrajectoryPanel({
  caseId, meta, row, entries, activeModel, onClose,
}: {
  caseId: string;
  meta: CaseMeta;
  row: CaseRow;
  entries: { agent: ManifestEntry[]; baseline: ManifestEntry[] };
  activeModel?: string;
  onClose: () => void;
}) {
  const [arm, setArm] = useState<"agent" | "baseline">("agent");
  const [showGraph, setShowGraph] = useState<boolean>(true);
  const list = entries[arm] || [];
  const b = row.baseline, a = row.agent;

  const isWin = (a?.f1 ?? 0) > (b?.f1 ?? 0);

  return (
    <>
      <div className={`overlay ${caseId ? "open" : ""}`} onClick={onClose} />
      <aside className={`drawer ${caseId ? "open" : ""}`} style={{ maxWidth: 840 }}>
        <div className="drawer-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className={`tag ${meta.item_type === "review_resolution" ? "review" : "changelog"}`}>
                {meta.item_type === "review_resolution" ? "PR Review" : "CHANGELOG"}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-faint)" }}>{caseId}</span>
            </div>
            <h3 style={{ margin: 0, fontSize: 18 }}>{meta.title}</h3>
            <div className="sub" style={{ marginTop: 3 }}>
              Evaluated on <strong>{activeModel || "openai / gpt-4o"}</strong>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          {/* VERDICT SUMMARY CARDS */}
          <div className="verdicts">
            <div className="vcard" style={{ borderLeft: (b?.f1 ?? 0) === 0 ? "3px solid var(--bad)" : "3px solid var(--border)" }}>
              <div className="vh">📄 Naive Baseline</div>
              <div>F1 <b className={(b?.f1 ?? 0) === 0 ? "zero" : "good"}>{b ? b.f1.toFixed(2) : "—"}</b></div>
              <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>
                {b ? `TP ${b.tp} · FP ${b.fp} · FN ${b.fn}` : ""}
              </div>
              {(b?.fp ?? 0) > 0 && (
                <div style={{ fontSize: 11, color: "var(--bad)", marginTop: 3, fontWeight: 600 }}>
                  ⚠️ {b?.fp} Hallucinated Claims
                </div>
              )}
            </div>

            <div className="vcard" style={{ borderLeft: "3px solid var(--good)" }}>
              <div className="vh">🧠 Multi-Agent Pipeline</div>
              <div>F1 <b style={{ color: "var(--good)" }}>{a ? a.f1.toFixed(2) : "—"}</b></div>
              <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>
                {a ? `TP ${a.tp} · FP ${a.fp} · FN ${a.fn}` : ""}
              </div>
              {isWin && (
                <div style={{ fontSize: 11, color: "var(--good)", marginTop: 3, fontWeight: 700 }}>
                  🏆 Win: +{((a?.f1 ?? 0) - (b?.f1 ?? 0)).toFixed(2)} F1
                </div>
              )}
            </div>

            <div className="vcard gt">
              <div className="vh">🎯 Expected Ground Truth</div>
              <GroundTruth meta={meta} />
            </div>
          </div>

          {/* TOGGLE VISUAL AGENT GRAPH */}
          <div style={{ margin: "14px 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={`action ${arm === "agent" ? "auto_ok" : ""}`}
                style={{ cursor: "pointer", fontWeight: 600 }}
                onClick={() => setArm("agent")}
              >
                🧠 Multi-Agent Trajectory ({entries.agent?.length || 0} agents)
              </button>
              <button
                className={`action ${arm === "baseline" ? "needs_human" : ""}`}
                style={{ cursor: "pointer", fontWeight: 600 }}
                onClick={() => setArm("baseline")}
              >
                📄 Flat Baseline Trajectory
              </button>
            </div>

            <button
              style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              onClick={() => setShowGraph((prev) => !prev)}
            >
              {showGraph ? "▲ Hide Visual Graph" : "▼ Show Visual Agent Graph"}
            </button>
          </div>

          {/* VISUAL AGENT GRAPH EMBED */}
          {showGraph && arm === "agent" && (
            <div style={{ marginBottom: 16 }}>
              <AgentGraph activeCaseId={caseId} />
            </div>
          )}

          {/* TRAJECTORY STEPS */}
          <h4 style={{ margin: "16px 0 8px", fontSize: 14, textTransform: "uppercase", color: "var(--text-faint)" }}>
            Turn-by-Turn Execution Steps ({arm.toUpperCase()} Arm):
          </h4>
          {list.map((e, i) => <AgentTraj key={i} entry={e} />)}
        </div>
      </aside>
    </>
  );
}
