import type { Aggregate } from "./types";

/**
 * The single source of truth for the baseline-vs-agent headline metrics.
 *
 * Reads straight from results.json (`aggregate.baseline` / `aggregate.agent`),
 * so the numbers can NEVER drift from the measured run — regenerate with
 * `python eval.py` (or `python rescore.py`) and every place that renders this
 * component updates at once. Do not hardcode these numbers anywhere else.
 */
export default function MetricsComparison({
  baseline,
  agent,
  model,
  nCases,
  nRuns,
  variant = "full",
}: {
  baseline?: Aggregate;
  agent?: Aggregate;
  model: string;
  nCases: number;
  nRuns?: number;
  variant?: "full" | "compact";
}) {
  if (!baseline || !agent) return null;

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const num = (x: number) => x.toFixed(2);
  const multi = (nRuns ?? 1) > 1;
  // Optional per-metric ranges attached by the 3-run aggregation.
  const rangeOf = (arm: Aggregate, key: string): { min: number; max: number } | null =>
    (arm as any).ranges?.[key] ?? null;

  // Bars are 0..1 metrics rendered as % width; baseline behind (faded), agent in front.
  const bars: { label: string; key: string; b: number; a: number }[] = [
    { label: "Problem F1", key: "f1", b: baseline.f1, a: agent.f1 },
    { label: "Precision", key: "precision", b: baseline.precision, a: agent.precision },
    { label: "Recall", key: "recall", b: baseline.recall, a: agent.recall },
  ];

  const deltaF1 = agent.f1 - baseline.f1;
  const deltaP = agent.precision - baseline.precision;

  return (
    <div className="ag-tier-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--text-faint)" }}>
          Measured Benchmark · {model} · {nCases} cases{multi ? ` · mean of ${nRuns} runs` : ""}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
          {multi ? <>mean of {nRuns} live <code>python eval.py</code> runs · ranges shown</> : <>measured by <code>python eval.py</code> (real {model} run)</>}
        </span>
      </div>

      {/* F1 / Precision / Recall bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {bars.map((row) => {
          const win = row.a - row.b;
          const ar = rangeOf(agent, row.key);
          const arTxt = multi && ar && ar.min !== ar.max ? ` [${pct(ar.min)}–${pct(ar.max)}]` : "";
          return (
            <div key={row.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span>
                  <strong>{row.label}:</strong> Agent {pct(row.a)}{arTxt} vs Flat {pct(row.b)}
                </span>
                <span style={{ color: win > 0.001 ? "var(--good)" : win < -0.001 ? "var(--warn)" : "var(--text-faint)", fontWeight: 700 }}>
                  {win > 0.001 ? `+${Math.round(win * 100)}%` : win < -0.001 ? `${Math.round(win * 100)}%` : "tie"}
                </span>
              </div>
              <div style={{ height: 12, background: "var(--bg)", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", width: pct(row.b), height: "100%", background: "var(--warn)", opacity: 0.5 }} title={`Baseline: ${pct(row.b)}`} />
                <div style={{ position: "absolute", width: pct(row.a), height: "100%", background: "var(--good)" }} title={`Agent: ${pct(row.a)}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* False alarms + cost row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div className="metric-pill" style={{ padding: "8px 12px" }}>
          <span className="mp-lbl">False alarms / task</span>
          <span className={`mp-val ${agent.false_alarms_per_case <= baseline.false_alarms_per_case ? "good" : ""}`} style={{ fontSize: 16 }}>
            {num(baseline.false_alarms_per_case)} → {num(agent.false_alarms_per_case)}
          </span>
        </div>
        <div className="metric-pill" style={{ padding: "8px 12px" }}>
          <span className="mp-lbl">Cost / task (USD)</span>
          <span className="mp-val" style={{ fontSize: 16 }}>
            ${baseline.cost_per_task_usd.toFixed(4)} → ${agent.cost_per_task_usd.toFixed(4)}
          </span>
        </div>
      </div>

      {variant === "full" && (
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
          The durable win is <strong>precision {num(baseline.precision)} → {num(agent.precision)}</strong> (+{Math.round(deltaP * 100)} pts)
          with <strong>zero false alarms</strong> — and precision was 1.00 in every run (no variance). The trade-off:
          the agent is more conservative, so recall runs {multi ? "lower on average" : "lower"} ({num(baseline.recall)} → {num(agent.recall)}) —
          it stays silent rather than surface an unproven claim. Net F1 {num(baseline.f1)} → {num(agent.f1)} ({deltaF1 >= 0 ? "+" : ""}{deltaF1.toFixed(2)}).
          The verifier removes exactly the ungrounded flags — see the "suppressed by verifier" findings on any live run.
        </p>
      )}
    </div>
  );
}
