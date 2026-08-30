import { useState, useEffect } from "react";

interface NodeDetail {
  id: string;
  stepNum: string;
  name: string;
  category: "input" | "router" | "specialist" | "tools" | "verifier" | "human" | "output";
  role: string;
  executionMode: "Parallel" | "Orchestrated" | "Deterministic" | "Iterative Loop" | "Human-Gated";
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
    stepNum: "01",
    name: "Repository Event Ingestion",
    category: "input",
    role: "Raw Git Trigger",
    executionMode: "Parallel",
    badgeText: "Step 01 · Ingestion",
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
    stepNum: "02",
    name: "Router & Orchestrator",
    category: "router",
    role: "Concurrent Task Dispatcher",
    executionMode: "Orchestrated",
    badgeText: "Step 02 · Orchestrator",
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
    stepNum: "03A",
    name: "Release CHANGELOG Auditor",
    category: "specialist",
    role: "Release Verification Specialist",
    executionMode: "Parallel",
    badgeText: "Step 03A · Specialist",
    badgeType: "specialist",
    description: "Specialized AI auditor that compares release notes against actual Git commit histories in parallel.",
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
    stepNum: "03B",
    name: "PR Review Resolution Specialist",
    category: "specialist",
    role: "Code Review Auditor",
    executionMode: "Parallel",
    badgeText: "Step 03B · Specialist",
    badgeType: "specialist",
    description: "Specialized AI auditor cross-examining reviewer comments against actual code diff hunks in parallel.",
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
    stepNum: "04",
    name: "Iterative On-Demand Git Tools Loop",
    category: "tools",
    role: "Multi-Turn Artifact Loop",
    executionMode: "Iterative Loop",
    badgeText: "Step 04 · Multi-Turn Loop 🔄",
    badgeType: "tool",
    description: "Multi-turn iterative loop where specialists query Git artifacts repeatedly until evidence is conclusive.",
    details: [
      "🔄 Iterative Loop: Specialist requests commit body → inspects patch → calls diff hunk → refines claim",
      "list_commits & get_commit: Drills deep into commit bodies where BREAKING CHANGE notes live",
      "get_diff_for_path & get_hunk: Fetches exact patch line numbers and AST contexts",
      "Forces every finding to cite a concrete physical artifact (SHA, path, hunk ID)",
    ],
    failureModeFixed: "Prevents hallucinated references by forcing agents to quote real repository data across multiple turns.",
    icon: "🔄",
  },
  verifier_grounding: {
    id: "verifier_grounding",
    stepNum: "05A",
    name: "Deterministic Grounding Engine",
    category: "verifier",
    role: "Layer 1 Proof Gate",
    executionMode: "Deterministic",
    badgeText: "Step 05A · Deterministic",
    badgeType: "verifier",
    description: "Zero-cost deterministic code validator enforcing strict evidence grounding before any LLM scoring.",
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
    stepNum: "05B",
    name: "Independent Soundness Auditor",
    category: "verifier",
    role: "Layer 2 Logic Verifier",
    executionMode: "Parallel",
    badgeText: "Step 05B · Soundness LLM",
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
    stepNum: "06",
    name: "Human Approval Gate",
    category: "human",
    role: "Maintainer Safety Checkpoint",
    executionMode: "Human-Gated",
    badgeText: "Step 06 · Safety Checkpoint",
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
    stepNum: "07",
    name: "Actionable Maintainer Verdict",
    category: "output",
    role: "Trusted Triage Action",
    executionMode: "Deterministic",
    badgeText: "Step 07 · Final Verdict",
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
    }, 1300);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleStartSim = () => {
    setSimStep(0);
    setSelectedKey("input");
    setIsSimulating(true);
  };

  return (
    <div className="agent-graph-container" style={{ padding: 20 }}>
      {/* HEADER WITH CONTROLS */}
      <div className="ag-header" style={{ marginBottom: 16 }}>
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
            Parallel Multi-Agent Architecture Studio
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
            Click any numbered step to inspect its execution contract and multi-turn iterative feedback loop.
          </p>
        </div>

        <button
          className="filter-btn active"
          onClick={handleStartSim}
          disabled={isSimulating}
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          {isSimulating ? "⚡ Simulating Flow..." : "▶ Simulate Flow"}
        </button>
      </div>

      {/* SIDE-BY-SIDE STUDIO LAYOUT */}
      <div className="ag-studio-layout">
        {/* LEFT COLUMN: VISUAL GRAPH CANVAS WITH BOLD ARROWS & NUMBERED TIERS */}
        <div className="ag-canvas-col">
          {/* TIER 1: INGESTION ➔ ROUTER */}
          <div className="ag-tier-card">
            <div className="ag-tier-tag">Step 01 &amp; 02 · Ingestion &amp; Dispatch</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <div
                className={`ag-compact-node ${selectedKey === "input" ? "selected" : ""} ${isSimulating && simStep === 0 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("input")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">01</span>
                  <span className="node-cat-badge">Trigger</span>
                </div>
                <div className="node-name">📥 Repository Event</div>
                <div className="node-desc">Raw Commits &amp; Diffs</div>
              </div>

              {/* BOLD SVG ARROW */}
              <div className="bold-arrow-wrap">
                <svg width="40" height="20" viewBox="0 0 40 20">
                  <line x1="2" y1="10" x2="30" y2="10" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                  <polygon points="28,4 38,10 28,16" fill="var(--accent)" />
                </svg>
              </div>

              <div
                className={`ag-compact-node primary ${selectedKey === "router" ? "selected" : ""} ${isSimulating && simStep === 1 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("router")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">02</span>
                  <span className="node-cat-badge primary">Orchestrator</span>
                </div>
                <div className="node-name">🧭 Router Agent</div>
                <div className="node-desc">Concurrent Dispatcher</div>
              </div>
            </div>
          </div>

          {/* BOLD DOWNWARD BRANCH ARROW */}
          <div className="bold-arrow-down-wrap">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <line x1="16" y1="2" x2="16" y2="24" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
              <polygon points="10,22 16,30 22,22" fill="var(--accent)" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>Concurrent Parallel Fork</span>
          </div>

          {/* TIER 2: PARALLEL SPECIALISTS */}
          <div className="ag-tier-card" style={{ background: "rgba(79, 70, 229, 0.03)", borderColor: "rgba(79, 70, 229, 0.25)" }}>
            <div className="ag-tier-tag" style={{ color: "var(--changelog)" }}>Step 03 · Parallel Domain Specialists</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
              <div
                className={`ag-compact-node ${selectedKey === "spec_changelog" ? "selected" : ""} ${isSimulating && simStep === 2 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("spec_changelog")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">03A</span>
                  <span className="node-cat-badge specialist">Release Notes</span>
                </div>
                <div className="node-name">📦 CHANGELOG Auditor</div>
                <div className="node-desc">Catches Stealth Breaking Changes</div>
              </div>

              <div
                className={`ag-compact-node ${selectedKey === "spec_review" ? "selected" : ""} ${isSimulating && simStep === 2 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("spec_review")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">03B</span>
                  <span className="node-cat-badge review">PR Review</span>
                </div>
                <div className="node-name">💬 PR Review Specialist</div>
                <div className="node-desc">Verifies Code vs Author Replies</div>
              </div>
            </div>

            {/* ITERATIVE MULTI-TURN TOOL LOOP */}
            <div
              className={`ag-compact-node tool-loop ${selectedKey === "tools" ? "selected" : ""} ${isSimulating && simStep === 3 ? "active-pulse" : ""}`}
              onClick={() => setSelectedKey("tools")}
              style={{ marginTop: 10 }}
            >
              <div className="node-badge-row">
                <span className="step-badge">04</span>
                <span className="node-cat-badge tool">🔄 Multi-Turn Iterative Loop</span>
              </div>
              <div className="node-name">🔧 On-Demand Git Tools Cluster</div>
              <div className="node-desc">
                <code>list_commits</code> ⇄ <code>get_commit</code> ⇄ <code>get_diff</code> (Iterative Multi-Turn Queries)
              </div>
            </div>
          </div>

          {/* BOLD DOWNWARD ARROW */}
          <div className="bold-arrow-down-wrap">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <line x1="16" y1="2" x2="16" y2="24" stroke="var(--good)" strokeWidth="3" strokeLinecap="round" />
              <polygon points="10,22 16,30 22,22" fill="var(--good)" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--good)", textTransform: "uppercase" }}>Evidence Grounding Seam</span>
          </div>

          {/* TIER 3: TWO-LAYER DUAL VERIFIER */}
          <div className="ag-tier-card" style={{ background: "rgba(16, 185, 129, 0.03)", borderColor: "var(--good-border)" }}>
            <div className="ag-tier-tag" style={{ color: "var(--good)" }}>Step 05 · Two-Layer Verification Engine (Load-Bearing in Score)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
              <div
                className={`ag-compact-node verifier ${selectedKey === "verifier_grounding" ? "selected" : ""} ${isSimulating && simStep === 4 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("verifier_grounding")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">05A</span>
                  <span className="node-cat-badge verifier">Layer 1</span>
                </div>
                <div className="node-name">🛡️ Deterministic Grounding</div>
                <div className="node-desc">Code-Level SHA &amp; Quote Match</div>
              </div>

              <div
                className={`ag-compact-node verifier ${selectedKey === "verifier_soundness" ? "selected" : ""} ${isSimulating && simStep === 5 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("verifier_soundness")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">05B</span>
                  <span className="node-cat-badge verifier">Layer 2</span>
                </div>
                <div className="node-name">🧠 Soundness Auditor</div>
                <div className="node-desc">Independent LLM Logic Pass</div>
              </div>
            </div>
          </div>

          {/* BOLD DOWNWARD ARROW */}
          <div className="bold-arrow-down-wrap">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <line x1="16" y1="2" x2="16" y2="24" stroke="var(--warn)" strokeWidth="3" strokeLinecap="round" />
              <polygon points="10,22 16,30 22,22" fill="var(--warn)" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)", textTransform: "uppercase" }}>Safety Checkpoint &amp; Verdict</span>
          </div>

          {/* TIER 4: SAFETY GATE ➔ VERDICT */}
          <div className="ag-tier-card">
            <div className="ag-tier-tag">Step 06 &amp; 07 · Maintainer Gate &amp; Action</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <div
                className={`ag-compact-node human ${selectedKey === "human_gate" ? "selected" : ""} ${isSimulating && simStep === 6 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("human_gate")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">06</span>
                  <span className="node-cat-badge human">Rule #04</span>
                </div>
                <div className="node-name">👤 Human Approval Gate</div>
                <div className="node-desc">Maintainer Confirms/Overrides</div>
              </div>

              {/* BOLD SVG ARROW */}
              <div className="bold-arrow-wrap">
                <svg width="40" height="20" viewBox="0 0 40 20">
                  <line x1="2" y1="10" x2="30" y2="10" stroke="var(--good)" strokeWidth="3" strokeLinecap="round" />
                  <polygon points="28,4 38,10 28,16" fill="var(--good)" />
                </svg>
              </div>

              <div
                className={`ag-compact-node verdict ${selectedKey === "output" ? "selected" : ""} ${isSimulating && simStep === 7 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("output")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">07</span>
                  <span className="node-cat-badge verdict">0 False Alarms</span>
                </div>
                <div className="node-name">⚡ Actionable Verdict</div>
                <div className="node-desc">AUTO_OK | NEEDS_HUMAN | ESCALATE</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STICKY NODE INSPECTOR PANEL (SIDE-BY-SIDE) */}
        <div className="ag-inspector-col">
          <div className="ag-sticky-inspector">
            <div className="ag-inspector-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="inspector-icon">{selected.icon}</span>
                <div>
                  <span className="inspector-step-tag">Step {selected.stepNum}</span>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selected.name}</h4>
                  <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{selected.role}</div>
                </div>
              </div>
              <span className="badge-model" style={{ marginTop: 8, display: "inline-block" }}>
                Mode: {selected.executionMode}
              </span>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5, margin: "12px 0 14px" }}>
              {selected.description}
            </p>

            <div style={{ marginBottom: 14 }}>
              <span className="ag-col-label">⚙️ Execution Logic &amp; Contract:</span>
              <ul className="ag-list" style={{ marginTop: 6 }}>
                {selected.details.map((d, i) => (
                  <li key={i} style={{ fontSize: 12.5, marginBottom: 4 }}>{d}</li>
                ))}
              </ul>
            </div>

            <div>
              <span className="ag-col-label" style={{ color: "var(--good)" }}>
                🛡️ Failure Mode Neutralized:
              </span>
              <div className="ag-callout-box" style={{ fontSize: 12.5, marginTop: 6 }}>
                {selected.failureModeFixed}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
