import { useEffect, useState } from "react";
import { loadTrajectory } from "./data";
import type { CaseMeta, ManifestEntry, CaseRow, Trajectory, TrajStep } from "./types";

const ROLE: Record<string, string> = {
  router: "orchestration",
  changelog_auditor: "specialist",
  review_resolver: "specialist",
  verifier: "verification",
  baseline: "single prompt",
};

function GroundTruth({ meta }: { meta: CaseMeta }) {
  const gt = meta.ground_truth;
  if (meta.item_type === "changelog_audit" && Array.isArray(gt)) {
    if (gt.length === 0)
      return <p className="finding"><span className="ok-check">✓</span> Clean release — nothing should be flagged.</p>;
    return (
      <>
        {gt.map((d: { type: string; ref: string }, i) => (
          <div className="finding" key={i}>
            <span className={`vlabel ${d.type}`}>{d.type}</span> <code>{d.ref}</code>
          </div>
        ))}
      </>
    );
  }
  if (meta.item_type === "review_resolution" && gt && typeof gt === "object") {
    const entries = Object.entries(gt as Record<string, string>);
    return (
      <>
        {entries.map(([cid, v]) => (
          <div className="finding" key={cid}>
            <code>{cid}</code> → <span className={`vlabel ${v}`}>{v}</span>
          </div>
        ))}
      </>
    );
  }
  return <p className="finding">—</p>;
}

function StepView({ s }: { s: TrajStep }) {
  if (s.kind === "model") {
    return (
      <div className="step">
        <div className="s-kind">model turn {s.step} · {s.stop_reason}</div>
        {(s.content || []).map((b, i) => {
          if (b.type === "text" && b.text?.trim())
            return <div className="s-text" key={i}>{b.text.trim()}</div>;
          if (b.type === "tool_use")
            return (
              <div className="toolcall" key={i}>
                calls <span className="tc-name">{b.name}</span>(
                {JSON.stringify(b.input)})
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
        <span className="pill-tool">{s.name}</span> returned{s.is_error ? " (error)" : ""}
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
        <span className="ta-role">{ROLE[entry.agent] || "agent"}</span>
        <span className="ta-meta">{entry.steps} steps · {entry.in + entry.out} tok</span>
      </div>
      {traj ? traj.steps.map((s, i) => <StepView key={i} s={s} />)
            : <div className="step s-text" style={{ color: "var(--text-faint)" }}>loading…</div>}
    </div>
  );
}

export default function TrajectoryPanel({
  caseId, meta, row, entries, onClose,
}: {
  caseId: string;
  meta: CaseMeta;
  row: CaseRow;
  entries: { agent: ManifestEntry[]; baseline: ManifestEntry[] };
  onClose: () => void;
}) {
  const [arm, setArm] = useState<"agent" | "baseline">("agent");
  const list = entries[arm] || [];
  const b = row.baseline, a = row.agent;

  return (
    <>
      <div className={`overlay ${caseId ? "open" : ""}`} onClick={onClose} />
      <aside className={`drawer ${caseId ? "open" : ""}`}>
        <div className="drawer-head">
          <div>
            <h3>{meta.title}</h3>
            <div className="sub">{meta.item_type} · run on {a ? "openai / gpt-4o-mini" : ""}</div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="drawer-body">
          <div className="verdicts">
            <div className="vcard">
              <div className="vh">Baseline</div>
              <div>F1 <b>{b ? b.f1.toFixed(2) : "—"}</b></div>
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {b ? `tp ${b.tp} · fp ${b.fp} · fn ${b.fn}` : ""}
              </div>
            </div>
            <div className="vcard">
              <div className="vh">Agent</div>
              <div>F1 <b style={{ color: "var(--good)" }}>{a ? a.f1.toFixed(2) : "—"}</b></div>
              <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {a ? `tp ${a.tp} · fp ${a.fp} · fn ${a.fn}` : ""}
              </div>
            </div>
            <div className="vcard gt">
              <div className="vh">Ground truth</div>
              <GroundTruth meta={meta} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button className={`action ${arm === "agent" ? "auto_ok" : "error"}`}
                    style={{ cursor: "pointer", border: "none" }}
                    onClick={() => setArm("agent")}>agent pipeline</button>
            <button className={`action ${arm === "baseline" ? "needs_human" : "error"}`}
                    style={{ cursor: "pointer", border: "none" }}
                    onClick={() => setArm("baseline")}>baseline</button>
          </div>

          {list.map((e, i) => <AgentTraj key={i} entry={e} />)}
        </div>
      </aside>
    </>
  );
}
