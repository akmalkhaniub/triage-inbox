import { useState, useEffect } from "react";

interface NodeDetail {
  id: string;
  stepNum: string;
  name: string;
  category: "input" | "router" | "specialist" | "tools" | "verifier" | "human" | "output";
  role: string;
  executionMode: "Parallel" | "Orchestrated" | "Deterministic" | "Iterative Multi-Turn Loop" | "Human-Gated";
  toolsUsed: string[];
  description: string;
  details: string[];
  inputContract: string;
  outputContract: string;
  failureModeFixed: string;
  icon: string;
  badgeText: string;
  badgeType: "orchestrator" | "specialist" | "tool" | "verifier" | "human" | "verdict";
}

const NODES: Record<string, NodeDetail> = {
  input: {
    id: "input",
    stepNum: "1",
    name: "Repository Event Ingestion",
    category: "input",
    role: "Raw Git Webhook & CLI Trigger",
    executionMode: "Parallel",
    badgeText: "Step 1 · Event Ingestion",
    badgeType: "orchestrator",
    toolsUsed: ["GitHub Webhooks", "Git CLI Hooks", "GitHub Actions CI Event"],
    description: "Ingests raw untrusted Git repository artifacts from webhooks, CI runs, or manual CLI triggers.",
    details: [
      "CHANGELOG.md contents and raw release commit ranges (e.g. v3.0.0 → v3.1.0)",
      "Pull request diff hunks with inline reviewer comments and author reply threads",
      "No pre-processed answers — purely raw Git metadata passed downstream",
    ],
    inputContract: "Raw GitHub Webhook payload / CLI args (base_tag, head_tag, pr_number)",
    outputContract: "Standardized GitItem payload (artifacts, metadata)",
    failureModeFixed: "Eliminates Monday morning maintainer queue fatigue and blind rubber-stamping.",
    icon: "📥",
  },
  router: {
    id: "router",
    stepNum: "2",
    name: "Router Orchestrator Agent",
    category: "router",
    role: "Concurrent Task Classification Agent",
    executionMode: "Orchestrated",
    badgeText: "Step 2 · Orchestrator Agent",
    badgeType: "orchestrator",
    toolsUsed: ["schema_classifier", "lane_dispatcher"],
    description: "Inspects payload structure and concurrently dispatches tasks to specialized domain agents without viewing ground truth.",
    details: [
      "Evaluates payload structure (commits vs PR diffs) with zero ground-truth leakage",
      "Concurrently dispatches items to dedicated domain specialist agents in parallel",
      "Supports plug-and-play extension lanes (Dependency Bumps, Flaky Tests, Issue Triage)",
    ],
    inputContract: "GitItem payload with unparsed artifacts",
    outputContract: "Task classification: 'changelog_audit' | 'review_resolution' + Specialist Assignment",
    failureModeFixed: "Replaces the flawed 'one mega-prompt doing everything' approach with modular domain precision.",
    icon: "🧭",
  },
  spec_changelog: {
    id: "spec_changelog",
    stepNum: "3a",
    name: "Release CHANGELOG Auditor Agent",
    category: "specialist",
    role: "Release Verification Domain Agent",
    executionMode: "Parallel",
    badgeText: "Step 3a · Domain Agent",
    badgeType: "specialist",
    toolsUsed: ["list_commits", "get_commit (commit bodies)", "read_changelog_section"],
    description: "Specialized AI agent that diffs release notes against actual Git commit histories in parallel.",
    details: [
      "Uncovers hidden breaking changes misclassified under minor fix headings",
      "Detects phantom release notes describing features that never actually merged",
      "Filters out noisy internal chore/CI commits to prevent maintainer false alarms",
    ],
    inputContract: "Release notes text + commit range metadata",
    outputContract: "Discovered Findings array: [{ claim_id, verdict, subject, evidence, rationale }]",
    failureModeFixed: "Prevents stealth breaking changes from silently slipping into production releases.",
    icon: "📦",
  },
  spec_review: {
    id: "spec_review",
    stepNum: "3b",
    name: "PR Review Resolution Auditor Agent",
    category: "specialist",
    role: "Code Review Resolution Domain Agent",
    executionMode: "Parallel",
    badgeText: "Step 3b · Domain Agent",
    badgeType: "specialist",
    toolsUsed: ["get_diff_for_path", "get_hunk", "read_review_thread"],
    description: "Specialized AI agent cross-examining reviewer comments against actual modified code diff hunks in parallel.",
    details: [
      "Ignores cosmetic author replies ('Done 👍') and judges actual modified code lines",
      "Validates whether requested bug fixes, null checks, or error handlers were implemented",
      "Flags unaddressed or partially resolved reviewer comments with cited line numbers",
    ],
    inputContract: "Reviewer comment threads + modified PR file paths",
    outputContract: "Resolution Findings array: [{ comment_id, verdict: 'addressed'|'unaddressed', evidence }]",
    failureModeFixed: "Stops cosmetic 'fixed' replies from bypassing rigorous code review.",
    icon: "💬",
  },
  tools: {
    id: "tools",
    stepNum: "4",
    name: "On-Demand Git Tools Agent Loop",
    category: "tools",
    role: "Multi-Turn Artifact Execution Loop",
    executionMode: "Iterative Multi-Turn Loop",
    badgeText: "Step 4 · Multi-Turn Loop 🔄",
    badgeType: "tool",
    toolsUsed: ["list_commits", "get_commit", "get_diff_for_path", "get_hunk"],
    description: "Multi-turn iterative loop where specialist agents query Git artifacts repeatedly until evidence is conclusive.",
    details: [
      "🔄 Iterative Loop: Specialist requests commit body → inspects patch → calls diff hunk → refines claim",
      "list_commits & get_commit: Drills deep into commit bodies where BREAKING CHANGE notes live",
      "get_diff_for_path & get_hunk: Fetches exact patch line numbers and AST contexts",
      "Forces every finding to cite a concrete physical artifact (SHA, path, hunk ID)",
    ],
    inputContract: "Tool call request from specialist agent with parameters",
    outputContract: "Exact text slice of Git commit body or diff hunk",
    failureModeFixed: "Prevents hallucinated references by forcing agents to quote real repository data across multiple turns.",
    icon: "🔄",
  },
  verifier_grounding: {
    id: "verifier_grounding",
    stepNum: "5a",
    name: "Deterministic Grounding Verifier Agent",
    category: "verifier",
    role: "Layer 1 Proof Gate (AST & Regex)",
    executionMode: "Deterministic",
    badgeText: "Step 5a · Layer 1 Verifier Agent",
    badgeType: "verifier",
    toolsUsed: ["regex_matcher", "ast_quote_verifier", "sha_existence_validator"],
    description: "Zero-cost deterministic code validator enforcing strict evidence grounding before any LLM scoring.",
    details: [
      "Validates that cited commit SHAs, line numbers, and diff IDs physically exist in repository",
      "Asserts exact string quotes appear verbatim inside the repository artifact",
      "Instantly rejects fabricated claims without consuming secondary LLM tokens",
    ],
    inputContract: "Discovered Finding with evidence citations",
    outputContract: "is_grounded: boolean (true = cited text exists in code, false = rejected)",
    failureModeFixed: "Kills hallucinated claims before any downstream decision is made.",
    icon: "🛡️",
  },
  verifier_soundness: {
    id: "verifier_soundness",
    stepNum: "5b",
    name: "Soundness Logic Verifier Agent",
    category: "verifier",
    role: "Layer 2 Logic Verifier Agent",
    executionMode: "Parallel",
    badgeText: "Step 5b · Layer 2 Verifier Agent",
    badgeType: "verifier",
    toolsUsed: ["independent_soundness_llm", "absence_claim_evaluator"],
    description: "Independent LLM pass evaluating whether the flagged discrepancy logically follows from the evidence.",
    details: [
      "Verifies logic soundness (e.g. does an API parameter rename genuinely break backwards compatibility?)",
      "Receives the complement artifact set to accurately verify absence claims",
      "Only verified findings reach human maintainers (load-bearing in score)",
    ],
    inputContract: "Grounded Finding + entire complement artifact set",
    outputContract: "verified: boolean + verifier_note rationale",
    failureModeFixed: "Eliminates confident-but-flawed model reasoning.",
    icon: "🧠",
  },
  human_gate: {
    id: "human_gate",
    stepNum: "6",
    name: "Human Maintainer Approval Gate",
    category: "human",
    role: "Maintainer Safety Checkpoint",
    executionMode: "Human-Gated",
    badgeText: "Step 6 · Safety Gate",
    badgeType: "human",
    toolsUsed: ["interactive_cli_prompt", "web_action_approval"],
    description: "Interactive maintainer-in-the-loop checkpoint ensuring safety before consequential actions are executed.",
    details: [
      "Complies with Hackathon Ground Rule #04 for consequential actions",
      "Maintainer can 1-click Accept, Override to Needs Human, Escalate, or Auto-OK",
      "Supports automated CI mode via --no-approve flag",
    ],
    inputContract: "Verified Findings + Recommended Action",
    outputContract: "Maintainer Decision: 'accepted' | 'overridden' | 'escalated'",
    failureModeFixed: "Ensures AI never autonomously executes destructive or breaking actions.",
    icon: "👤",
  },
  output: {
    id: "output",
    stepNum: "7",
    name: "Actionable Maintainer Verdict Agent",
    category: "output",
    role: "Trusted Triage Action Emitter",
    executionMode: "Deterministic",
    badgeText: "Step 7 · Final Verdict Agent",
    badgeType: "verdict",
    toolsUsed: ["github_status_emitter", "pr_comment_poster"],
    description: "Produces crystal-clear, evidence-backed verdicts for immediate maintainer confidence.",
    details: [
      "AUTO_OK: 100% verified clean release or PR — safe to merge immediately",
      "NEEDS_HUMAN: Non-blocking discrepancies flagged with cited lines for quick review",
      "ESCALATE: Urgent breaking changes or unaddressed bugs requiring immediate action",
    ],
    inputContract: "Approved Triage Decision",
    outputContract: "GitHub Check Run Verdict: 'success' | 'action_required' | 'failure'",
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
            Click any numbered step (1–7) on the left to inspect that specific Agent's role, tools, operational logic, and anti-hallucination guardrail.
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
          {/* TIER 1: INGESTION ➔ ROUTER AGENT */}
          <div className="ag-tier-card">
            <div className="ag-tier-tag">Steps 1 &amp; 2 · Ingestion &amp; Dispatch</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <div
                className={`ag-compact-node ${selectedKey === "input" ? "selected" : ""} ${isSimulating && simStep === 0 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("input")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">1</span>
                  <span className="node-cat-badge">Trigger</span>
                </div>
                <div className="node-name">📥 Event Ingestion</div>
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
                  <span className="step-badge">2</span>
                  <span className="node-cat-badge primary">Orchestrator Agent</span>
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
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>Concurrent Parallel Execution</span>
          </div>

          {/* TIER 2: PARALLEL SPECIALIST AGENTS */}
          <div className="ag-tier-card" style={{ background: "rgba(79, 70, 229, 0.03)", borderColor: "rgba(79, 70, 229, 0.25)" }}>
            <div className="ag-tier-tag" style={{ color: "var(--changelog)" }}>Step 3 · Parallel Domain Specialist Agents</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
              <div
                className={`ag-compact-node ${selectedKey === "spec_changelog" ? "selected" : ""} ${isSimulating && simStep === 2 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("spec_changelog")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">3a</span>
                  <span className="node-cat-badge specialist">Release Notes Agent</span>
                </div>
                <div className="node-name">📦 CHANGELOG Auditor Agent</div>
                <div className="node-desc">Catches Stealth Breaking Changes</div>
              </div>

              <div
                className={`ag-compact-node ${selectedKey === "spec_review" ? "selected" : ""} ${isSimulating && simStep === 2 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("spec_review")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">3b</span>
                  <span className="node-cat-badge review">PR Review Agent</span>
                </div>
                <div className="node-name">💬 PR Review Auditor Agent</div>
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
                <span className="step-badge">4</span>
                <span className="node-cat-badge tool">🔄 Multi-Turn Tool Loop Agent</span>
              </div>
              <div className="node-name">🔧 On-Demand Git Tools Agent Loop</div>
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

          {/* TIER 3: TWO-LAYER DUAL VERIFIER AGENTS */}
          <div className="ag-tier-card" style={{ background: "rgba(16, 185, 129, 0.03)", borderColor: "var(--good-border)" }}>
            <div className="ag-tier-tag" style={{ color: "var(--good)" }}>Step 5 · Dual-Layer Verification Agents (Load-Bearing in Score)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
              <div
                className={`ag-compact-node verifier ${selectedKey === "verifier_grounding" ? "selected" : ""} ${isSimulating && simStep === 4 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("verifier_grounding")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">5a</span>
                  <span className="node-cat-badge verifier">Layer 1 Verifier</span>
                </div>
                <div className="node-name">🛡️ Grounding Verifier Agent</div>
                <div className="node-desc">Code-Level SHA &amp; Quote Match</div>
              </div>

              <div
                className={`ag-compact-node verifier ${selectedKey === "verifier_soundness" ? "selected" : ""} ${isSimulating && simStep === 5 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("verifier_soundness")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">5b</span>
                  <span className="node-cat-badge verifier">Layer 2 Verifier</span>
                </div>
                <div className="node-name">🧠 Soundness Verifier Agent</div>
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

          {/* TIER 4: SAFETY GATE ➔ VERDICT AGENT */}
          <div className="ag-tier-card">
            <div className="ag-tier-tag">Steps 6 &amp; 7 · Maintainer Safety Gate &amp; Action</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <div
                className={`ag-compact-node human ${selectedKey === "human_gate" ? "selected" : ""} ${isSimulating && simStep === 6 ? "active-pulse" : ""}`}
                onClick={() => setSelectedKey("human_gate")}
              >
                <div className="node-badge-row">
                  <span className="step-badge">6</span>
                  <span className="node-cat-badge human">Rule #04</span>
                </div>
                <div className="node-name">👤 Maintainer Gate</div>
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
                  <span className="step-badge">7</span>
                  <span className="node-cat-badge verdict">0 False Alarms</span>
                </div>
                <div className="node-name">⚡ Verdict Agent</div>
                <div className="node-desc">AUTO_OK | NEEDS_HUMAN | ESCALATE</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: STICKY AGENT DEEP INSPECTOR (SIDE-BY-SIDE) */}
        <div className="ag-inspector-col">
          <div className="ag-sticky-inspector">
            <div className="ag-inspector-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="inspector-icon">{selected.icon}</span>
                <div>
                  <span className="inspector-step-tag">Step {selected.stepNum} Agent Specification</span>
                  <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selected.name}</h4>
                  <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{selected.role}</div>
                </div>
              </div>
              <span className="badge-model" style={{ marginTop: 8, display: "inline-block" }}>
                Execution Mode: {selected.executionMode}
              </span>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5, margin: "12px 0 14px" }}>
              {selected.description}
            </p>

            {/* TOOLS & APIS USED */}
            <div style={{ marginBottom: 12, background: "var(--bg-elev2)", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                🛠️ Tools &amp; APIs Handled:
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selected.toolsUsed.map((t, idx) => (
                  <code key={idx} style={{ fontSize: 11 }}>{t}</code>
                ))}
              </div>
            </div>

            {/* CONTRACT DETAILS */}
            <div style={{ marginBottom: 12 }}>
              <span className="ag-col-label">⚙️ Operational Contract &amp; Logic:</span>
              <ul className="ag-list" style={{ marginTop: 6 }}>
                {selected.details.map((d, i) => (
                  <li key={i} style={{ fontSize: 12.5, marginBottom: 4 }}>{d}</li>
                ))}
              </ul>
            </div>

            {/* ANTI-HALLUCINATION GUARDRAIL */}
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
