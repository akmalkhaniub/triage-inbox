import { useState } from "react";

interface NodeDetail {
  id: string;
  name: string;
  category: "input" | "router" | "specialist" | "tools" | "verifier" | "human" | "output";
  role: string;
  executionMode: "Parallel" | "Orchestrated" | "Deterministic" | "Human-Gated";
  description: string;
  details: string[];
  failureModeFixed: string;
  icon: string;
}

const NODES: Record<string, NodeDetail> = {
  input: {
    id: "input",
    name: "Repository Event Input",
    category: "input",
    role: "Raw Git Trigger",
    executionMode: "Parallel",
    description: "Raw repository events ingested via Git hooks, GitHub Actions, or Webhook payloads.",
    details: [
      "Target release tag comparison (e.g. v3.0.0 → v3.1.0) with CHANGELOG.md notes",
      "Pull request diff hunks with reviewer inline comments and author reply threads",
      "No pre-digested answers — raw untrusted Git metadata",
    ],
    failureModeFixed: "Eliminates Monday morning maintainer queue fatigue and blind skimming.",
    icon: "📥",
  },
  router: {
    id: "router",
    name: "Router & Orchestrator",
    category: "router",
    role: "Concurrent Task Dispatcher",
    executionMode: "Orchestrated",
    description: "Intelligent dispatcher analyzing item schema and dispatching tasks to dedicated specialists in parallel.",
    details: [
      "Inspects payload structure (commits vs PR diffs) without viewing ground truth",
      "Dispatches concurrently to specialized domain agents",
      "Supports seamless drop-in extension lanes (Dependency Bumps, Flaky Tests, Issue Triage)",
    ],
    failureModeFixed: "Replaces the flawed 'one mega-prompt doing everything' failure mode with modular precision.",
    icon: "🧭",
  },
  spec_changelog: {
    id: "spec_changelog",
    name: "Release CHANGELOG Auditor",
    category: "specialist",
    role: "Release Verification Specialist",
    executionMode: "Parallel",
    description: "Specialized AI auditor that compares release notes against actual Git commit histories.",
    details: [
      "Uncovers hidden breaking changes misclassified under minor headings",
      "Detects phantom release notes describing features that never merged",
      "Filters out noisy internal chore commits to avoid false alarms",
    ],
    failureModeFixed: "Prevents breaking changes from silently slipping into production releases.",
    icon: "📦",
  },
  spec_review: {
    id: "spec_review",
    name: "PR Review Resolution Specialist",
    category: "specialist",
    role: "Code Review Auditor",
    executionMode: "Parallel",
    description: "Specialized AI auditor cross-examining reviewer comments against actual code diff hunks.",
    details: [
      "Ignores cosmetic author replies ('Done 👍') and judges actual code changes",
      "Validates whether requested bug fixes or null checks were implemented",
      "Flags unaddressed or partially resolved reviewer comments",
    ],
    failureModeFixed: "Stops cosmetic 'fixed' replies from bypassing code review.",
    icon: "💬",
  },
  tools: {
    id: "tools",
    name: "On-Demand Git Tools",
    category: "tools",
    role: "Parallel Artifact Fetchers",
    executionMode: "Parallel",
    description: "High-speed tools called concurrently during agent reasoning to pull exact repository slices.",
    details: [
      "list_commits & get_commit: Drills deep into commit bodies where BREAKING CHANGE notes live",
      "get_diff_for_path & get_hunk: Fetches exact patch line numbers and AST contexts",
      "Forces every finding to cite a concrete physical artifact",
    ],
    failureModeFixed: "Prevents hallucinated references by forcing agents to quote real repository data.",
    icon: "🔧",
  },
  verifier_grounding: {
    id: "verifier_grounding",
    name: "Deterministic Grounding Engine",
    category: "verifier",
    role: "Layer 1 Proof Gate",
    executionMode: "Deterministic",
    description: "Zero-cost deterministic code validator enforcing strict evidence grounding.",
    details: [
      "Validates that cited commit SHAs, line numbers, and diff IDs physically exist",
      "Asserts exact string quotes appear verbatim inside the repository artifact",
      "Instantly rejects fabricated claims without consuming secondary LLM tokens",
    ],
    failureModeFixed: "Kills hallucinated claims before any downstream decision is made.",
    icon: "🛡️",
  },
  verifier_soundness: {
    id: "verifier_soundness",
    name: "Independent Soundness Auditor",
    category: "verifier",
    role: "Layer 2 Logic Verifier",
    executionMode: "Parallel",
    description: "Independent LLM pass evaluating whether the flagged discrepancy logically follows from the evidence.",
    details: [
      "Verifies logic soundness (e.g. does an API parameter rename genuinely break backwards compatibility?)",
      "Receives the complement artifact set to accurately verify absence claims",
      "Only verified findings reach human maintainers",
    ],
    failureModeFixed: "Eliminates confident-but-flawed model reasoning.",
    icon: "🧠",
  },
  human_gate: {
    id: "human_gate",
    name: "Human Approval Gate",
    category: "human",
    role: "Maintainer Checkpoint",
    executionMode: "Human-Gated",
    description: "Interactive maintainer-in-the-loop checkpoint ensuring safety before actions are executed.",
    details: [
      "Complies with Hackathon Ground Rule #04 for consequential actions",
      "Maintainer can 1-click Accept, Override to Needs Human, Escalate, or Auto-OK",
      "Supports automated CI mode via --no-approve flag",
    ],
    failureModeFixed: "Ensures AI never autonomously executes destructive repository actions.",
    icon: "👤",
  },
  output: {
    id: "output",
    name: "Actionable Maintainer Verdict",
    category: "output",
    role: "Trusted Triage Action",
    executionMode: "Deterministic",
    description: "Produces crystal-clear, evidence-backed verdicts for immediate maintainer confidence.",
    details: [
      "AUTO_OK: 100% verified clean release or PR — safe to merge immediately",
      "NEEDS_HUMAN: Non-blocking discrepancies flagged with cited lines for quick review",
      "ESCALATE: Urgent breaking changes or unaddressed bugs requiring immediate action",
    ],
    failureModeFixed: "Cuts false alarms to ZERO on GPT-4o, restoring complete trust in automated triage.",
    icon: "⚡",
  },
};

export default function AgentGraph({
  activeCaseId,
}: {
  activeCaseId?: string;
}) {
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>("router");
  const selected = NODES[selectedNodeKey] || NODES["router"];

  return (
    <div className="agent-graph-container">
      {/* HEADER */}
      <div className="ag-header">
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800 }}>
            🧠 Parallel Multi-Agent Architecture Topology
          </h3>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-dim)" }}>
            A modular, concurrent multi-agent graph with parallel on-demand tool execution and two-layer proof verification. Click any node to inspect its execution contract.
          </p>
        </div>
        {activeCaseId && (
          <span className="badge-model" style={{ color: "var(--accent)" }}>
            Active Case: {activeCaseId}
          </span>
        )}
      </div>

      {/* PARALLEL MULTI-TIER GRAPH DIAGRAM */}
      <div className="ag-parallel-canvas">
        {/* TIER 1: INGESTION & ROUTER */}
        <div className="ag-tier">
          <div className="ag-tier-label">Tier 1 · Ingestion &amp; Dispatch</div>
          <div className="ag-tier-nodes">
            <div
              className={`ag-node-box ${selectedNodeKey === "input" ? "selected" : ""}`}
              onClick={() => setSelectedNodeKey("input")}
            >
              <span className="ag-icon">📥</span>
              <div>
                <strong>Repository Event</strong>
                <div className="ag-sub">Raw Git Commits &amp; PR Diffs</div>
              </div>
            </div>

            <div className="ag-arrow-h">➔</div>

            <div
              className={`ag-node-box primary ${selectedNodeKey === "router" ? "selected" : ""}`}
              onClick={() => setSelectedNodeKey("router")}
            >
              <span className="ag-icon">🧭</span>
              <div>
                <strong>Router &amp; Orchestrator</strong>
                <div className="ag-sub">Concurrent Task Classification</div>
              </div>
              <span className="ag-pill">Orchestrator</span>
            </div>
          </div>
        </div>

        {/* TIER 2: PARALLEL SPECIALIST LANES & ON-DEMAND TOOLS */}
        <div className="ag-tier" style={{ background: "rgba(37,99,235,0.03)", border: "1px dashed var(--border)" }}>
          <div className="ag-tier-label">Tier 2 · Parallel Domain Specialists &amp; On-Demand Git Tools</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%" }}>
            {/* SPECIALIST 1 */}
            <div
              className={`ag-node-box ${selectedNodeKey === "spec_changelog" ? "selected" : ""}`}
              onClick={() => setSelectedNodeKey("spec_changelog")}
            >
              <span className="ag-icon">📦</span>
              <div>
                <strong>Release CHANGELOG Auditor</strong>
                <div className="ag-sub">Diffs Release Notes vs Git Commits</div>
              </div>
              <span className="ag-pill" style={{ background: "rgba(79, 70, 229, 0.1)", color: "var(--changelog)" }}>Parallel Lane</span>
            </div>

            {/* SPECIALIST 2 */}
            <div
              className={`ag-node-box ${selectedNodeKey === "spec_review" ? "selected" : ""}`}
              onClick={() => setSelectedNodeKey("spec_review")}
            >
              <span className="ag-icon">💬</span>
              <div>
                <strong>PR Review Resolution Specialist</strong>
                <div className="ag-sub">Cross-Examines Comments vs Diffs</div>
              </div>
              <span className="ag-pill" style={{ background: "rgba(13, 148, 136, 0.1)", color: "var(--review)" }}>Parallel Lane</span>
            </div>
          </div>

          {/* PARALLEL TOOLS CALLOUT */}
          <div
            className={`ag-node-box tool-box ${selectedNodeKey === "tools" ? "selected" : ""}`}
            onClick={() => setSelectedNodeKey("tools")}
            style={{ width: "100%", marginTop: 8 }}
          >
            <span className="ag-icon">🔧</span>
            <div style={{ flex: 1 }}>
              <strong>On-Demand Git Tools Cluster</strong>
              <div className="ag-sub"><code>list_commits</code> · <code>get_commit</code> (reads commit bodies) · <code>get_diff_for_path</code> · <code>get_hunk</code></div>
            </div>
            <span className="ag-pill tool">On-Demand Slices</span>
          </div>
        </div>

        {/* TIER 3: TWO-LAYER DUAL VERIFIER */}
        <div className="ag-tier" style={{ background: "rgba(16,185,129,0.03)", border: "1px dashed var(--good-border)" }}>
          <div className="ag-tier-label" style={{ color: "var(--good)" }}>Tier 3 · Two-Layer Verification Seam (Load-Bearing in Score)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%" }}>
            <div
              className={`ag-node-box ${selectedNodeKey === "verifier_grounding" ? "selected" : ""}`}
              onClick={() => setSelectedNodeKey("verifier_grounding")}
            >
              <span className="ag-icon">🛡️</span>
              <div>
                <strong>Layer 1: Deterministic Grounding</strong>
                <div className="ag-sub">Code-Level SHA &amp; Quote Existence Proof</div>
              </div>
              <span className="ag-pill verified">Deterministic Proof</span>
            </div>

            <div
              className={`ag-node-box ${selectedNodeKey === "verifier_soundness" ? "selected" : ""}`}
              onClick={() => setSelectedNodeKey("verifier_soundness")}
            >
              <span className="ag-icon">🧠</span>
              <div>
                <strong>Layer 2: Soundness Auditor</strong>
                <div className="ag-sub">Independent LLM Logical Reasoning Check</div>
              </div>
              <span className="ag-pill verified">Soundness Proof</span>
            </div>
          </div>
        </div>

        {/* TIER 4: HUMAN GATE & VERDICT */}
        <div className="ag-tier">
          <div className="ag-tier-label">Tier 4 · Safety Gate &amp; Actionable Verdict</div>
          <div className="ag-tier-nodes">
            <div
              className={`ag-node-box ${selectedNodeKey === "human_gate" ? "selected" : ""}`}
              onClick={() => setSelectedNodeKey("human_gate")}
            >
              <span className="ag-icon">👤</span>
              <div>
                <strong>Human Approval Gate</strong>
                <div className="ag-sub">Ground Rule #04 Maintainer Checkpoint</div>
              </div>
              <span className="ag-pill human">Human-in-Loop</span>
            </div>

            <div className="ag-arrow-h">➔</div>

            <div
              className={`ag-node-box output-box ${selectedNodeKey === "output" ? "selected" : ""}`}
              onClick={() => setSelectedNodeKey("output")}
            >
              <span className="ag-icon">⚡</span>
              <div>
                <strong>Actionable Maintainer Verdict</strong>
                <div className="ag-sub"><code>AUTO_OK</code> · <code>NEEDS_HUMAN</code> · <code>ESCALATE</code></div>
              </div>
              <span className="ag-pill" style={{ background: "var(--good-bg)", color: "var(--good)" }}>0 False Alarms</span>
            </div>
          </div>
        </div>
      </div>

      {/* NODE DETAIL INSPECTOR */}
      <div className="ag-detail-panel">
        <div className="ag-detail-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>{selected.icon}</span>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {selected.name} — <span style={{ color: "var(--accent)", fontSize: 14 }}>{selected.role}</span>
              </h4>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
                {selected.description}
              </p>
            </div>
            <span className="badge-model" style={{ marginLeft: "auto" }}>
              Execution: {selected.executionMode}
            </span>
          </div>
        </div>

        <div className="ag-detail-body">
          <div className="ag-detail-col">
            <span className="ag-col-label">⚙️ Execution Logic &amp; Operational Contract:</span>
            <ul className="ag-list">
              {selected.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>

          <div className="ag-detail-col">
            <span className="ag-col-label" style={{ color: "var(--good)" }}>
              🛡️ Failure Mode Neutralized:
            </span>
            <div className="ag-callout-box">
              {selected.failureModeFixed}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
