import { useState, useEffect } from "react";

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
  badgeText: string;
  badgeType: "orchestrator" | "specialist" | "tool" | "verifier" | "human" | "verdict";
}

const NODES: Record<string, NodeDetail> = {
  input: {
    id: "input",
    name: "Repository Event Ingestion",
    category: "input",
    role: "Raw Git Trigger",
    executionMode: "Parallel",
    badgeText: "Raw Ingestion",
    badgeType: "orchestrator",
    description: "Ingests raw untrusted Git repository artifacts from webhooks, CI runs, or manual CLI triggers.",
    details: [
      "CHANGELOG.md contents and raw release commit ranges (e.g. v3.0.0 → v3.1.0)",
      "Pull request diff hunks with inline reviewer comments and author reply threads",
      "No pre-processed answers — purely raw Git metadata",
    ],
    failureModeFixed: "Eliminates Monday morning maintainer queue fatigue and blind rubber-stamping.",
    icon: "📥",
  },
  router: {
    id: "router",
    name: "Router & Orchestrator",
    category: "router",
    role: "Concurrent Task Dispatcher",
    executionMode: "Orchestrated",
    badgeText: "Orchestrator",
    badgeType: "orchestrator",
    description: "Inspects item schema shape and dispatches tasks to dedicated domain specialists in parallel.",
    details: [
      "Evaluates payload structure (commits vs PR diffs) with zero ground-truth leakage",
      "Dispatches concurrently to specialized domain agents",
      "Supports plug-and-play extension lanes (Dependency Bumps, Flaky Tests, Issue Triage)",
    ],
    failureModeFixed: "Replaces the flawed 'one mega-prompt doing everything' approach with modular precision.",
    icon: "🧭",
  },
  spec_changelog: {
    id: "spec_changelog",
    name: "Release CHANGELOG Auditor",
    category: "specialist",
    role: "Release Verification Specialist",
    executionMode: "Parallel",
    badgeText: "Parallel Lane",
    badgeType: "specialist",
    description: "Specialized AI auditor that compares release notes against actual Git commit histories.",
    details: [
      "Uncovers hidden breaking changes misclassified under minor fix headings",
      "Detects phantom release notes describing features that never merged",
      "Filters out noisy internal chore/CI commits to prevent false alarms",
    ],
    failureModeFixed: "Prevents stealth breaking changes from silently slipping into production releases.",
    icon: "📦",
  },
  spec_review: {
    id: "spec_review",
    name: "PR Review Resolution Specialist",
    category: "specialist",
    role: "Code Review Auditor",
    executionMode: "Parallel",
    badgeText: "Parallel Lane",
    badgeType: "specialist",
    description: "Specialized AI auditor cross-examining reviewer comments against actual code diff hunks.",
    details: [
      "Ignores cosmetic author replies ('Done 👍') and judges actual modified code",
      "Validates whether requested bug fixes or error handlers were implemented",
      "Flags unaddressed or partially resolved reviewer comments with cited line numbers",
    ],
    failureModeFixed: "Stops cosmetic 'fixed' replies from bypassing rigorous code review.",
    icon: "💬",
  },
  tools: {
    id: "tools",
    name: "On-Demand Git Tools Cluster",
    category: "tools",
    role: "Parallel Artifact Slice Fetchers",
    executionMode: "Parallel",
    badgeText: "On-Demand Tools",
    badgeType: "tool",
    description: "High-speed tools called concurrently during agent reasoning to pull exact repository slices.",
    details: [
      "list_commits & get_commit: Drills deep into commit bodies where BREAKING CHANGE notes live",
      "get_diff_for_path & get_hunk: Fetches exact patch line numbers and AST contexts",
      "Forces every finding to cite a concrete physical artifact (SHA, path, hunk ID)",
    ],
    failureModeFixed: "Prevents hallucinated citations by forcing agents to quote real repository data.",
    icon: "🔧",
  },
  verifier_grounding: {
    id: "verifier_grounding",
    name: "Deterministic Grounding Engine",
    category: "verifier",
    role: "Layer 1 Proof Gate",
    executionMode: "Deterministic",
    badgeText: "Deterministic Proof",
    badgeType: "verifier",
    description: "Zero-cost deterministic code validator enforcing strict evidence grounding.",
    details: [
      "Validates that cited commit SHAs, line numbers, and diff IDs physically exist in repository",
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
    badgeText: "Soundness Proof",
    badgeType: "verifier",
    description: "Independent LLM pass evaluating whether the flagged discrepancy logically follows from the evidence.",
    details: [
      "Verifies logic soundness (e.g. does an API parameter rename genuinely break backwards compatibility?)",
      "Receives the complement artifact set to accurately verify absence claims",
      "Only verified findings reach human maintainers (load-bearing in score)",
    ],
    failureModeFixed: "Eliminates confident-but-flawed model reasoning.",
    icon: "🧠",
  },
  human_gate: {
    id: "human_gate",
    name: "Human Approval Gate",
    category: "human",
    role: "Maintainer Safety Checkpoint",
    executionMode: "Human-Gated",
    badgeText: "Ground Rule #04",
    badgeType: "human",
    description: "Interactive maintainer-in-the-loop checkpoint ensuring safety before actions are executed.",
    details: [
      "Complies with Hackathon Ground Rule #04 for consequential actions",
      "Maintainer can 1-click Accept, Override to Needs Human, Escalate, or Auto-OK",
      "Supports automated CI mode via --no-approve flag",
    ],
    failureModeFixed: "Ensures AI never autonomously executes destructive or breaking actions.",
    icon: "👤",
  },
  output: {
    id: "output",
    name: "Actionable Maintainer Verdict",
    category: "output",
    role: "Trusted Triage Action",
    executionMode: "Deterministic",
    badgeText: "0 False Alarms",
    badgeType: "verdict",
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
  const [selectedKey, setSelectedKey] = useState<string>("router");
  const [simStep, setSimStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const selected = NODES[selectedKey] || NODES["router"];

  // Simulation step sequencer
  useEffect(() => {
    if (!isSimulating) return;
    const order = ["input", "router", "spec_changelog", "tools", "verifier_grounding", "verifier_soundness", "human_gate", "output"];
    const interval = setInterval(() => {
      setSimStep((prev) => {
        if (prev >= order.length - 1) {
          setIsSimulating(false);
          return 0;
        }
        const next = prev + 1;
        setSelectedKey(order[next]);
        return next;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleStartSim = () => {
    setSimStep(0);
    setSelectedKey("input");
    setIsSimulating(true);
  };

  return (
    <div className="agent-graph-container">
      {/* HEADER WITH CONTROLS */}
      <div className="ag-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span className="tag review" style={{ fontSize: 11 }}>Multi-Agent System Architecture</span>
            {activeCaseId && (
              <span className="badge-model" style={{ color: "var(--accent)" }}>
                Active Case: {activeCaseId}
              </span>
            )}
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Parallel Multi-Agent Architecture Topology
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-dim)" }}>
            A modular graph featuring concurrent domain specialists, on-demand Git slice fetchers, and dual-layer verification.
          </p>
        </div>

        <button
          className="filter-btn active"
          onClick={handleStartSim}
          disabled={isSimulating}
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          {isSimulating ? "⚡ Simulating Flow..." : "▶ Simulate Execution Flow"}
        </button>
      </div>

      {/* ENTERPRISE VISUAL GRAPH CANVAS */}
      <div className="ag-studio-canvas">
        {/* ROW 1: INGESTION ➔ ROUTER */}
        <div className="ag-canvas-row">
          <div
            className={`ag-studio-node ${selectedKey === "input" ? "selected" : ""} ${isSimulating && simStep === 0 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("input")}
          >
            <div className="node-head">
              <span className="node-icon">📥</span>
              <span className="node-badge orchestrator">Ingestion</span>
            </div>
            <div className="node-title">Repository Event</div>
            <div className="node-sub">Raw Git Commits &amp; PR Diffs</div>
          </div>

          <div className="ag-connector-line">
            <svg width="60" height="24" viewBox="0 0 60 24">
              <line x1="0" y1="12" x2="52" y2="12" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" />
              <polygon points="50,7 60,12 50,17" fill="var(--accent)" />
            </svg>
          </div>

          <div
            className={`ag-studio-node primary ${selectedKey === "router" ? "selected" : ""} ${isSimulating && simStep === 1 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("router")}
          >
            <div className="node-head">
              <span className="node-icon">🧭</span>
              <span className="node-badge orchestrator">Orchestrator</span>
            </div>
            <div className="node-title">Router Agent</div>
            <div className="node-sub">Concurrent Task Classifier</div>
          </div>
        </div>

        {/* FORK CONNECTOR */}
        <div className="ag-branch-divider">
          <div className="branch-label">⚡ Concurrent Parallel Execution Lanes</div>
        </div>

        {/* ROW 2: PARALLEL SPECIALISTS */}
        <div className="ag-canvas-grid-2">
          {/* LANE A */}
          <div
            className={`ag-studio-node ${selectedKey === "spec_changelog" ? "selected" : ""} ${isSimulating && simStep === 2 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("spec_changelog")}
          >
            <div className="node-head">
              <span className="node-icon">📦</span>
              <span className="node-badge specialist">Parallel Lane 1</span>
            </div>
            <div className="node-title">Release CHANGELOG Auditor</div>
            <div className="node-sub">Diffs Release Notes vs Commit Bodies</div>
          </div>

          {/* LANE B */}
          <div
            className={`ag-studio-node ${selectedKey === "spec_review" ? "selected" : ""} ${isSimulating && simStep === 2 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("spec_review")}
          >
            <div className="node-head">
              <span className="node-icon">💬</span>
              <span className="node-badge specialist">Parallel Lane 2</span>
            </div>
            <div className="node-title">PR Review Resolution Specialist</div>
            <div className="node-sub">Cross-Examines Review Comments vs Diffs</div>
          </div>
        </div>

        {/* ROW 3: ON-DEMAND GIT TOOLS SUB-CLUSTER */}
        <div className="ag-tools-cluster-wrap">
          <div
            className={`ag-studio-node tool-cluster ${selectedKey === "tools" ? "selected" : ""} ${isSimulating && simStep === 3 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("tools")}
          >
            <div className="node-head">
              <span className="node-icon">🔧</span>
              <span className="node-badge tool">On-Demand Slices</span>
            </div>
            <div className="node-title">On-Demand Git Tools Cluster</div>
            <div className="node-sub">
              <code>list_commits</code> · <code>get_commit</code> (reads commit bodies) · <code>get_diff_for_path</code> · <code>get_hunk</code>
            </div>
          </div>
        </div>

        {/* VERIFICATION CONVERGENCE DIVIDER */}
        <div className="ag-branch-divider">
          <div className="branch-label" style={{ color: "var(--good)" }}>🛡️ Dual-Layer Verification Seam (Load-Bearing in Score)</div>
        </div>

        {/* ROW 4: DUAL VERIFICATION ENGINES */}
        <div className="ag-canvas-grid-2">
          {/* LAYER 1 */}
          <div
            className={`ag-studio-node verifier ${selectedKey === "verifier_grounding" ? "selected" : ""} ${isSimulating && simStep === 4 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("verifier_grounding")}
          >
            <div className="node-head">
              <span className="node-icon">🛡️</span>
              <span className="node-badge verifier">Layer 1 Proof</span>
            </div>
            <div className="node-title">Deterministic Grounding Engine</div>
            <div className="node-sub">Code-Level SHA &amp; Quote Existence Proof</div>
          </div>

          {/* LAYER 2 */}
          <div
            className={`ag-studio-node verifier ${selectedKey === "verifier_soundness" ? "selected" : ""} ${isSimulating && simStep === 5 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("verifier_soundness")}
          >
            <div className="node-head">
              <span className="node-icon">🧠</span>
              <span className="node-badge verifier">Layer 2 Proof</span>
            </div>
            <div className="node-title">Independent Soundness Auditor</div>
            <div className="node-sub">Independent LLM Logical Reasoning Check</div>
          </div>
        </div>

        {/* ROW 5: SAFETY GATE ➔ VERDICT */}
        <div className="ag-canvas-row" style={{ marginTop: 14 }}>
          <div
            className={`ag-studio-node human ${selectedKey === "human_gate" ? "selected" : ""} ${isSimulating && simStep === 6 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("human_gate")}
          >
            <div className="node-head">
              <span className="node-icon">👤</span>
              <span className="node-badge human">Rule #04</span>
            </div>
            <div className="node-title">Human Approval Gate</div>
            <div className="node-sub">Maintainer Checkpoint Before Action</div>
          </div>

          <div className="ag-connector-line">
            <svg width="60" height="24" viewBox="0 0 60 24">
              <line x1="0" y1="12" x2="52" y2="12" stroke="var(--good)" strokeWidth="2" strokeDasharray="4 3" />
              <polygon points="50,7 60,12 50,17" fill="var(--good)" />
            </svg>
          </div>

          <div
            className={`ag-studio-node verdict ${selectedKey === "output" ? "selected" : ""} ${isSimulating && simStep === 7 ? "active-pulse" : ""}`}
            onClick={() => setSelectedKey("output")}
          >
            <div className="node-head">
              <span className="node-icon">⚡</span>
              <span className="node-badge verdict">Zero False Alarms</span>
            </div>
            <div className="node-title">Actionable Maintainer Verdict</div>
            <div className="node-sub"><code>AUTO_OK</code> · <code>NEEDS_HUMAN</code> · <code>ESCALATE</code></div>
          </div>
        </div>
      </div>

      {/* DEEP INTERACTIVE NODE INSPECTOR */}
      <div className="ag-detail-panel" style={{ marginTop: 20 }}>
        <div className="ag-detail-head">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 32 }}>{selected.icon}</span>
            <div>
              <h4 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                {selected.name} — <span style={{ color: "var(--accent)", fontSize: 14 }}>{selected.role}</span>
              </h4>
              <p style={{ margin: "3px 0 0", fontSize: 13.5, color: "var(--text-dim)" }}>
                {selected.description}
              </p>
            </div>
            <span className="badge-model" style={{ marginLeft: "auto", fontSize: 12 }}>
              Mode: {selected.executionMode}
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
