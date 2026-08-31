import { useState } from "react";

/**
 * Renders one agent trajectory for the live GitHub runner: header, the exact
 * SYSTEM PROMPT the agent was given (collapsible — this is the "instructions"
 * deliverable), and every model / tool step with inputs and returned output.
 *
 * Used for BOTH the multi-agent arm and the flat baseline arm so the two are
 * fully inspectable side by side (prompt, tokens, and steps).
 */
export default function LiveTrajectoryCard({ traj }: { traj: any }) {
  const [showPrompt, setShowPrompt] = useState(false);

  const role =
    traj.agent === "router"
      ? "Router Orchestrator"
      : traj.agent.includes("verifier")
      ? "Grounding & Soundness Verifier"
      : traj.agent === "baseline"
      ? "Flat Single-Prompt Baseline (no tools, no verifier)"
      : "Domain Specialist Agent";

  return (
    <div className="traj-agent" style={{ margin: 0 }}>
      <div className="ta-head">
        <span className="ta-name">{traj.agent}</span>
        <span className="ta-role">{role}</span>
        <span className="ta-meta">
          {traj.input_tokens} in / {traj.output_tokens} out ·{" "}
          {traj.input_tokens + traj.output_tokens} tokens
        </span>
      </div>

      {/* SYSTEM PROMPT — the instructions that shaped this agent */}
      {traj.system && (
        <div style={{ margin: "8px 0" }}>
          <button
            onClick={() => setShowPrompt((s) => !s)}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--accent)",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {showPrompt ? "▾ Hide" : "▸ Show"} system prompt (instructions)
          </button>
          {showPrompt && (
            <pre
              style={{
                margin: "6px 0 0",
                whiteSpace: "pre-wrap",
                fontSize: 11.5,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                padding: 10,
                borderRadius: 6,
                maxHeight: 320,
                overflowY: "auto",
                color: "var(--text-dim)",
              }}
            >
              {traj.system}
            </pre>
          )}
        </div>
      )}

      {traj.steps.map((step: any, sIdx: number) => {
        const isTool = step.kind === "tool" || !!step.name;
        return (
          <div
            className="step"
            key={sIdx}
            style={{
              margin: "8px 0",
              padding: "10px 14px",
              background: "var(--bg-elev2)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div className="s-kind" style={{ fontWeight: 700, fontSize: 13, color: isTool ? "var(--accent)" : "var(--text)" }}>
                Step #{sIdx + 1} · {isTool ? `🔧 Tool Call: ${step.name}` : "💭 Model Reasoning & Response"}
              </div>
              <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-faint)" }}>
                {step.stop_reason ? `stop: ${step.stop_reason}` : isTool ? "executed" : ""}
              </span>
            </div>

            {isTool ? (
              <div>
                <div className="toolcall" style={{ margin: "4px 0 8px" }}>
                  <strong>Parameters:</strong> <code>{JSON.stringify(step.input || step.args || {})}</code>
                </div>
                {step.result !== undefined && (
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>
                      Returned Output:
                    </span>
                    <pre
                      className="toolresult"
                      style={{ margin: "4px 0 0", maxHeight: 220, overflowY: "auto", fontSize: 11.5, background: "var(--bg)", padding: 8, borderRadius: 6 }}
                    >
                      {typeof step.result === "string" ? step.result : JSON.stringify(step.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {Array.isArray(step.content) &&
                  step.content.map((b: any, bIdx: number) => {
                    if (b.type === "text" && b.text?.trim()) {
                      return (
                        <div key={bIdx} className="s-text" style={{ fontSize: 12.5, margin: "6px 0", whiteSpace: "pre-wrap", color: "var(--text)" }}>
                          {b.text.trim()}
                        </div>
                      );
                    }
                    if (b.type === "thinking" && b.thinking) {
                      return (
                        <div key={bIdx} style={{ fontSize: 12, color: "var(--text-dim)", fontStyle: "italic", background: "var(--bg)", padding: 8, borderRadius: 6, margin: "6px 0", borderLeft: "3px solid var(--accent)" }}>
                          💭 <strong>Extended Thinking:</strong> {b.thinking}
                        </div>
                      );
                    }
                    if (b.type === "tool_use") {
                      return (
                        <div key={bIdx} className="toolcall" style={{ margin: "6px 0" }}>
                          <strong>🔧 Invoked Tool:</strong> <span className="tc-name">{b.name}</span>(<code>{JSON.stringify(b.input || {})}</code>)
                        </div>
                      );
                    }
                    return null;
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
