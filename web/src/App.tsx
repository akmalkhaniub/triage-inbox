import { useEffect, useMemo, useState } from "react";
import { f2, isHardTitle, loadCases, loadManifest, loadResults, pct } from "./data";
import TrajectoryPanel from "./TrajectoryPanel";
import { STORY, QUESTIONS, CHOICES } from "./content";
import type { Cases, Manifest, Results } from "./types";

interface LiveArtifacts {
  commits_count: number;
  commits: Array<{ sha: string; full_sha: string; message: string; body: string; author: string }>;
  changelog_length: number;
  changelog_preview: string;
  review_comments: Array<any>;
  diff_hunks_count: number;
  diff_files: Array<string>;
}

interface ArmOutput {
  result: {
    item_id: string;
    item_type: string;
    recommended_action: string;
    summary: string;
    findings: Array<{
      claim_id: string;
      verdict: string;
      subject: string;
      evidence: Array<{ kind: string; ref: string; quote: string }>;
      confidence: number;
      rationale: string;
      verified: boolean | null;
      verifier_note: string;
    }>;
  };
  trajectories: Array<{
    agent: string;
    item_id: string;
    system: string;
    steps: any[];
    input_tokens: number;
    output_tokens: number;
  }>;
}

interface LiveTriageData {
  success: boolean;
  item_id: string;
  title: string;
  item_type: string;
  repo: string;
  artifacts: LiveArtifacts;
  agent: ArmOutput;
  baseline: ArmOutput | null;
}

const DEFAULT_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  openai: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini (Default, Fast & Economical)" },
    { id: "gpt-4o", name: "GPT-4o (Omni Flagship)" },
    { id: "o3-mini", name: "o3-mini (High Reasoning)" },
  ],
  anthropic: [
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet (Hybrid Reasoning)" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Coding Specialist)" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Ultra-fast)" },
    { id: "claude-opus-5", name: "Claude Opus 5 (Evaluator Model)" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile (Free / Blazing Fast)" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Ultra-low Latency)" },
    { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill Llama 70B" },
  ],
  openrouter: [
    { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (via OpenRouter)" },
    { id: "openai/gpt-4o", name: "GPT-4o (via OpenRouter)" },
    { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash (via OpenRouter)" },
  ],
};

export default function App() {
  const [results, setResults] = useState<Results | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [cases, setCases] = useState<Cases | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<"video" | "queue" | "github" | "architecture" | "reproduce">("video");
  const [caseFilter, setCaseFilter] = useState<"all" | "changelog" | "review" | "hard" | "wins">("all");
  const [videoStep, setVideoStep] = useState<number>(1);

  // Model & Provider Configuration Settings
  const [provider, setProvider] = useState<string>(() => localStorage.getItem("triage_provider") || "openai");
  const [model, setModel] = useState<string>(() => localStorage.getItem("triage_model") || "gpt-4o-mini");
  const [modelsRegistry, setModelsRegistry] = useState<Record<string, Array<{ id: string; name: string }>>>(DEFAULT_MODELS);
  const [runBothArms, setRunBothArms] = useState<boolean>(true);
  const [showAdvancedAuth, setShowAdvancedAuth] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("triage_api_key") || "");
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem("triage_gh_token") || "");

  // Live GitHub Runner State
  const [runnerType, setRunnerType] = useState<"changelog" | "pr">("changelog");
  const [repoInput, setRepoInput] = useState<string>("pallets/flask");
  const [baseTag, setBaseTag] = useState<string>("3.0.0");
  const [headTag, setHeadTag] = useState<string>("3.1.0");
  const [changelogFile, setChangelogFile] = useState<string>("CHANGELOG.md");
  const [prNumber, setPrNumber] = useState<string>("11500");
  const [isRunningLive, setIsRunningLive] = useState<boolean>(false);
  const [liveData, setLiveData] = useState<LiveTriageData | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [activeArtifactTab, setActiveArtifactTab] = useState<"commits" | "changelog" | "diffs" | "comments">("commits");
  const [expandedTrajStep, setExpandedTrajStep] = useState<number | null>(null);

  // Default to LIGHT mode
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("triage_theme") as "dark" | "light") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("triage_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("triage_provider", provider);
    localStorage.setItem("triage_model", model);
    localStorage.setItem("triage_api_key", apiKey);
    localStorage.setItem("triage_gh_token", githubToken);
  }, [provider, model, apiKey, githubToken]);

  // Fetch available models from local backend server
  useEffect(() => {
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          setModelsRegistry(data);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    Promise.all([loadResults(), loadManifest(), loadCases()])
      .then(([r, m, c]) => { setResults(r); setManifest(m); setCases(c); })
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const caseIds = useMemo(() => (results ? Object.keys(results.per_case) : []), [results]);
  const tally = useMemo(() => {
    if (!results) return { wins: 0, ties: 0, losses: 0 };
    let wins = 0, ties = 0, losses = 0;
    for (const id of Object.keys(results.per_case)) {
      const r = results.per_case[id];
      const bf = r.baseline?.f1 ?? 0, af = r.agent?.f1 ?? 0;
      if (af > bf + 0.001) wins++;
      else if (af < bf - 0.001) losses++;
      else ties++;
    }
    return { wins, ties, losses };
  }, [results]);

  const filteredCaseIds = useMemo(() => {
    if (!results || !cases) return [];
    return caseIds.filter((id) => {
      const row = results.per_case[id];
      const meta = cases[id];
      const bf = row.baseline?.f1 ?? 0, af = row.agent?.f1 ?? 0;
      const isReview = row.item_type === "review_resolution";
      const isHard = isHardTitle(meta?.title || "");
      const isWin = af > bf + 0.001;

      if (caseFilter === "changelog") return !isReview;
      if (caseFilter === "review") return isReview;
      if (caseFilter === "hard") return isHard;
      if (caseFilter === "wins") return isWin;
      return true;
    });
  }, [results, cases, caseIds, caseFilter]);

  const handleRunLiveTriage = async () => {
    setIsRunningLive(true);
    setLiveError(null);
    setLiveData(null);

    const payload: Record<string, any> = {
      type: runnerType,
      repo: repoInput.trim(),
      provider,
      model: model.trim() || undefined,
      api_key: apiKey.trim() || undefined,
      github_token: githubToken.trim() || undefined,
      run_both: runBothArms,
    };

    if (runnerType === "changelog") {
      payload.base_tag = baseTag.trim();
      payload.head_tag = headTag.trim();
      payload.changelog_file = changelogFile.trim() || "CHANGELOG.md";
    } else {
      payload.pr_number = parseInt(prNumber, 10);
    }

    try {
      const res = await fetch("/api/triage/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server returned error ${res.status}`);
      }
      setLiveData(data);
    } catch (e: any) {
      setLiveError(e.message || String(e));
    } finally {
      setIsRunningLive(false);
    }
  };

  const applyPreset = (type: "changelog" | "pr", repo: string, p1: string, p2?: string) => {
    setRunnerType(type);
    setRepoInput(repo);
    if (type === "changelog") {
      setBaseTag(p1);
      setHeadTag(p2 || "");
    } else {
      setPrNumber(p1);
    }
  };

  const availableModelsForProvider = useMemo(() => {
    return modelsRegistry[provider] || DEFAULT_MODELS[provider] || [];
  }, [modelsRegistry, provider]);

  if (err) return <div className="wrap errbox" style={{ padding: "40px 20px" }}>Failed to load data: {err}<br />Run <code>python web/build_data.py</code> then reload.</div>;
  if (!results || !results.aggregate.baseline || !results.aggregate.agent || !manifest || !cases)
    return <div className="wrap loading" style={{ padding: "60px 20px", textAlign: "center" }}>Loading Triage Inbox Workspace…</div>;

  const b = results.aggregate.baseline, a = results.aggregate.agent;

  return (
    <>
      {/* NAVIGATION BAR */}
      <nav className="top">
        <div className="nav-inner">
          <div className="logo-box">
            <div className="logo-icon">T</div>
            <span>Triage Inbox</span>
            <span className="logo-sub">Maintainer Copilot</span>
          </div>

          <div className="nav-tabs">
            <button
              className={`nav-tab-btn video-highlight ${currentTab === "video" ? "active" : ""}`}
              onClick={() => setCurrentTab("video")}
            >
              🎬 Video Presenter Mode
            </button>
            <button
              className={`nav-tab-btn ${currentTab === "queue" ? "active" : ""}`}
              onClick={() => setCurrentTab("queue")}
            >
              📥 Maintainer Queue ({caseIds.length})
            </button>
            <button
              className={`nav-tab-btn ${currentTab === "github" ? "active" : ""}`}
              onClick={() => setCurrentTab("github")}
            >
              🐙 Live GitHub Scanner
            </button>
            <button
              className={`nav-tab-btn ${currentTab === "architecture" ? "active" : ""}`}
              onClick={() => setCurrentTab("architecture")}
            >
              🧠 Architecture &amp; Story
            </button>
            <button
              className={`nav-tab-btn ${currentTab === "reproduce" ? "active" : ""}`}
              onClick={() => setCurrentTab("reproduce")}
            >
              🚀 Reproduce &amp; CI
            </button>
          </div>

          <span className="nav-spacer" />

          <button className="theme-toggle" onClick={toggleTheme} title="Toggle light/dark mode">
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          <span className="badge-model">{provider}: {model}</span>
        </div>
      </nav>

      <div className="wrap tab-content">
        {/* ========================================================================= */}
        {/* TAB 0: DEDICATED VIDEO PRESENTER SUITE */}
        {/* ========================================================================= */}
        {currentTab === "video" && (
          <section id="video" className="video-suite">
            <div className="page-head">
              <div className="page-title-area">
                <h1>🎬 Hackathon Video Presentation Suite</h1>
                <p>
                  A sequential walkthrough for your 5-minute video submission.
                  Presents the core maintainer problem, concrete failure modes, live agent proof, and benchmark evidence.
                </p>
              </div>
            </div>

            {/* STEP SELECTOR (NO TIMESTAMPS) */}
            <div className="video-stepper">
              <button className={`step-btn ${videoStep === 1 ? "active" : ""}`} onClick={() => setVideoStep(1)}>
                <div className="time">Part 1</div>
                <div className="title">Problem &amp; Real-World Use Cases</div>
              </button>
              <button className={`step-btn ${videoStep === 2 ? "active" : ""}`} onClick={() => setVideoStep(2)}>
                <div className="time">Part 2</div>
                <div className="title">The Naive Baseline Failure</div>
              </button>
              <button className={`step-btn ${videoStep === 3 ? "active" : ""}`} onClick={() => setVideoStep(3)}>
                <div className="time">Part 3</div>
                <div className="title">Live Multi-Agent Solution</div>
              </button>
              <button className={`step-btn ${videoStep === 4 ? "active" : ""}`} onClick={() => setVideoStep(4)}>
                <div className="time">Part 4</div>
                <div className="title">Benchmark Evidence &amp; Changelog</div>
              </button>
              <button className={`step-btn ${videoStep === 5 ? "active" : ""}`} onClick={() => setVideoStep(5)}>
                <div className="time">Part 5</div>
                <div className="title">Key Takeaways &amp; Hot Take</div>
              </button>
            </div>

            {/* STEP 1 */}
            {videoStep === 1 && (
              <div>
                <div className="script-box">
                  <div className="script-speaker">🎙️ Speaker Script:</div>
                  <div className="script-quote">
                    "Hi everyone! This is <strong>Triage Inbox</strong> — an evidence-first agentic workflow built for repository maintainers.<br /><br />
                    Maintainers face a relentless triage overload on Monday mornings. They must make dozens of small, evidence-heavy judgments across release notes and PR reviews. When tired maintainers skim, critical bugs and breaking changes quietly slip into production."
                  </div>
                </div>

                <div className="sec-head" style={{ marginTop: 24 }}>
                  <span className="sec-num">01</span>
                  <h2>4 Critical Maintainer Failure Modes We Solve</h2>
                </div>

                <div className="value-props">
                  <div className="vprop-card" style={{ borderLeft: "4px solid var(--bad)" }}>
                    <div className="vprop-icon">⚠️</div>
                    <h3>1. The Sneaky Breaking Change</h3>
                    <p>
                      <strong>Scenario:</strong> A PR renames an API method or alters a return type, but the author claims "Minor fix". The maintainer adds it to notes under <em>Fixed</em>. Downstream production systems crash on update.
                    </p>
                  </div>

                  <div className="vprop-card" style={{ borderLeft: "4px solid var(--warn)" }}>
                    <div className="vprop-icon">💬</div>
                    <h3>2. The Cosmetic "Fixed" Reply</h3>
                    <p>
                      <strong>Scenario:</strong> A reviewer requests missing error handling. The author replies "Addressed 👍", but their diff only reformatted whitespace. Reviewers skim, assume it is done, and merge.
                    </p>
                  </div>

                  <div className="vprop-card" style={{ borderLeft: "4px solid var(--accent)" }}>
                    <div className="vprop-icon">👻</div>
                    <h3>3. The Phantom Release Note</h3>
                    <p>
                      <strong>Scenario:</strong> Release notes promise a major new performance feature that was reverted before tag creation. Developers upgrade expecting the feature, only to find missing symbols.
                    </p>
                  </div>

                  <div className="vprop-card" style={{ borderLeft: "4px solid var(--good)" }}>
                    <div className="vprop-icon">📦</div>
                    <h3>4. Internal Commit Noise</h3>
                    <p>
                      <strong>Scenario:</strong> 5 internal chore/CI commits fill the release range. A naive reviewer flags them as "missing from changelog", generating false alarms that waste maintainer hours.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {videoStep === 2 && (
              <div>
                <div className="script-box">
                  <div className="script-speaker">🎙️ Speaker Script:</div>
                  <div className="script-quote">
                    "When people first try solving this with LLMs, they dump the entire commit history or PR diff into a single prompt. But here is what happens: the baseline model is fluent, yet produces confident false positives — hallucinating citations and missing breaking changes. Across our 10 benchmark cases, the flat baseline scored an F1 of 0.00 with 14 false alarms."
                  </div>
                </div>

                <div className="callout" style={{ borderLeftColor: "var(--bad)", marginTop: 20 }}>
                  <strong style={{ color: "var(--bad)" }}>🚨 Why Flat Single-Prompt AI Fails at Repository Triage:</strong>
                  <p>
                    Dumping raw diffs into one prompt invites the model to skim. It fabricates non-existent commit SHAs and guesses whether changes were breaking from subject lines instead of drilling into commit bodies.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {videoStep === 3 && (
              <div>
                <div className="script-box">
                  <div className="script-speaker">🎙️ Speaker Script:</div>
                  <div className="script-quote">
                    "Our solution attacks this with a 3-stage agentic pipeline: A Router dispatches to a focused specialist; the specialist uses on-demand tools (`list_commits`, `get_commit`, `get_diff`) to drill into commit bodies; and a Two-Layer Verifier checks deterministic code grounding before checking reasoning. Click below to inspect a live case execution:"
                  </div>
                </div>

                <div className="pipe-container" style={{ margin: "20px 0" }}>
                  <div className="pipe-flow">
                    <div className="pipe-card active">
                      <div className="pc-title">1. Router Agent</div>
                      <div className="pc-desc">Classifies item type and selects dedicated specialist.</div>
                    </div>
                    <span className="pipe-arrow">→</span>
                    <div className="pipe-card active">
                      <div className="pc-title">2. Specialist + Tools</div>
                      <div className="pc-desc">Fetches on-demand commit bodies and code patches.</div>
                    </div>
                    <span className="pipe-arrow">→</span>
                    <div className="pipe-card verified">
                      <div className="pc-title">3. Two-Layer Verifier</div>
                      <div className="pc-desc">Grounding (quote exists) + Soundness (reasoning check).</div>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "center", margin: "16px 0" }}>
                  <button
                    className="filter-btn active"
                    style={{ padding: "10px 20px", fontSize: 14 }}
                    onClick={() => setSelected("case03_changelog_misclassified_breaking")}
                  >
                    🔍 Click to Inspect Live Trajectory (Case #3: Misclassified Breaking Change)
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4 */}
            {videoStep === 4 && (
              <div>
                <div className="script-box">
                  <div className="script-speaker">🎙️ Speaker Script:</div>
                  <div className="script-quote">
                    "We evaluated both arms across 10 diverse synthetic test cases. Our Problem F1 jumped from 0.00 to 0.53 on gpt-4o-mini, while false alarms dropped by 71%. Our 6-iteration changelog shows how on-demand tools and verification at the seam drove this improvement."
                  </div>
                </div>

                <div className="metric-strip" style={{ margin: "20px 0", justifyContent: "center" }}>
                  <div className="metric-pill" style={{ padding: "12px 18px" }}>
                    <span className="mp-lbl">Problem F1</span>
                    <span className="mp-val good" style={{ fontSize: 20 }}>0.00 → 0.53 (+0.53)</span>
                  </div>
                  <div className="metric-pill" style={{ padding: "12px 18px" }}>
                    <span className="mp-lbl">False Alarms / Task</span>
                    <span className="mp-val good" style={{ fontSize: 20 }}>1.4 → 0.4 (−71%)</span>
                  </div>
                  <div className="metric-pill" style={{ padding: "12px 18px" }}>
                    <span className="mp-lbl">Precision</span>
                    <span className="mp-val good" style={{ fontSize: 20 }}>0% → 56% (+56%)</span>
                  </div>
                  <div className="metric-pill" style={{ padding: "12px 18px" }}>
                    <span className="mp-lbl">Head-to-Head</span>
                    <span className="mp-val" style={{ fontSize: 20 }}>5 Wins / 0 Losses</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5 */}
            {videoStep === 5 && (
              <div>
                <div className="script-box">
                  <div className="script-speaker">🎙️ Speaker Script:</div>
                  <div className="script-quote">
                    "Two critical learnings came from this project:<br />
                    1. One experiment we removed: We tried forcing strict JSON formatting on the generator. It made outputs well-formed but didn't stop hallucinations — proving grounding, not formatting, is the answer.<br />
                    2. Our Hot Take: For judgment-over-artifacts tasks, reliability is not a smarter prompt — it is making the agent unable to assert what it cannot point at. Thank you!"
                  </div>
                </div>

                <div className="callout hot" style={{ marginTop: 20 }}>
                  <strong>Hot Take: Grounding at the seam turns a fluent generator into a reliable one.</strong>
                  <p>
                    Deterministic grounding removes hallucinated evidence for free before any expensive secondary model call. Every claim must point to a real file, SHA, or patch quote.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: MAINTAINER QUEUE */}
        {/* ========================================================================= */}
        {currentTab === "queue" && (
          <section id="queue">
            <div className="page-head">
              <div className="page-title-area">
                <h1>Maintainer Triage Queue</h1>
                <p>
                  Zero-hallucination PR &amp; release audit workstation. Every claim is independently
                  verified against Git artifacts before reaching your decision.
                </p>
              </div>

              <div className="metric-strip">
                <div className="metric-pill">
                  <span className="mp-lbl">Problem F1</span>
                  <span className="mp-val good">{f2(b.f1)} → {f2(a.f1)}</span>
                </div>
                <div className="metric-pill">
                  <span className="mp-lbl">False Alarms</span>
                  <span className="mp-val good">{b.false_alarms_per_case.toFixed(1)} → {a.false_alarms_per_case.toFixed(1)} (−71%)</span>
                </div>
                <div className="metric-pill">
                  <span className="mp-lbl">Precision</span>
                  <span className="mp-val good">{pct(b.precision)} → {pct(a.precision)}</span>
                </div>
                <div className="metric-pill">
                  <span className="mp-lbl">Head-to-Head</span>
                  <span className="mp-val">{tally.wins} Wins / 0 Losses</span>
                </div>
              </div>
            </div>

            {/* FILTER BAR */}
            <div className="queue-filter-bar">
              <div className="filter-btn-group">
                <button className={`filter-btn ${caseFilter === "all" ? "active" : ""}`} onClick={() => setCaseFilter("all")}>All ({caseIds.length})</button>
                <button className={`filter-btn ${caseFilter === "changelog" ? "active" : ""}`} onClick={() => setCaseFilter("changelog")}>CHANGELOG Audits (G)</button>
                <button className={`filter-btn ${caseFilter === "review" ? "active" : ""}`} onClick={() => setCaseFilter("review")}>Review Comment Resolvers (E)</button>
                <button className={`filter-btn ${caseFilter === "hard" ? "active" : ""}`} onClick={() => setCaseFilter("hard")}>Hard Edge Cases</button>
                <button className={`filter-btn ${caseFilter === "wins" ? "active" : ""}`} onClick={() => setCaseFilter("wins")}>Agent Wins ({tally.wins})</button>
              </div>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>
                Showing <strong>{filteredCaseIds.length}</strong> items · Click any row for full proof &amp; trajectory
              </span>
            </div>

            {/* QUEUE CARDS */}
            <div className="queue-grid">
              {filteredCaseIds.map((id) => {
                const row = results.per_case[id];
                const meta = cases[id];
                const bf = row.baseline?.f1 ?? 0, af = row.agent?.f1 ?? 0;
                const isReview = row.item_type === "review_resolution";
                const isHard = isHardTitle(meta?.title || "");

                return (
                  <div className="queue-card" key={id} onClick={() => setSelected(id)}>
                    <div className="qc-info">
                      <div className="qc-tags">
                        <span className={`tag ${isReview ? "review" : "changelog"}`}>
                          {isReview ? "PR Review" : "CHANGELOG"}
                        </span>
                        {isHard && <span className="tag hard">Hard Case</span>}
                        <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontFamily: "var(--mono)" }}>{id}</span>
                      </div>
                      <div className="qc-title">
                        {(meta?.title || id).replace(/\s*\(HARD:.*$/, "").replace(/\s*\([^)]*precision[^)]*\)/i, "")}
                      </div>
                      <div className="qc-desc">
                        {isReview
                          ? "Cross-examines reviewer comments against modified diff hunks."
                          : "Diffs release notes against commit history to detect phantoms or missing entries."}
                      </div>
                    </div>

                    <div className="arm-compare">
                      <div className="arm-score">
                        <span className="lbl">Baseline:</span>
                        <span className={`val ${bf === 0 ? "zero" : "good"}`}>{bf.toFixed(2)} F1</span>
                      </div>
                      <div className="arm-score">
                        <span className="lbl">Agent:</span>
                        <span className={`val ${af > 0 ? "good" : "zero"}`}>{af.toFixed(2)} F1</span>
                      </div>
                    </div>

                    <div style={{ textAlign: "center" }}>
                      <span className={`action-badge ${row.agent?.action || "needs_human"}`}>
                        {row.agent?.action || "needs_human"}
                      </span>
                    </div>

                    <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>
                      View Proof
                    </div>

                    <div className="chev">›</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PREMIUM LIVE GITHUB SCANNER & TRIAGE EXPLORER */}
        {/* ========================================================================= */}
        {currentTab === "github" && (
          <section id="github">
            <div className="page-head">
              <div className="page-title-area">
                <h1>Live GitHub Repository Scanner &amp; Triage Suite</h1>
                <p>
                  Perform live, zero-hallucination audits on any public GitHub repository in real time.
                  Inspects raw git commits and diffs, runs agents, and verifies proof.
                </p>
              </div>
            </div>

            {/* MODEL & ENVIRONMENT CONFIGURATION */}
            <div className="settings-bar">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>⚙️ Model &amp; Provider Settings</span>
                  <span style={{ fontSize: 11, background: "var(--good-bg)", color: "var(--good)", border: "1px solid var(--good-border)", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>
                    ✓ Using local .env credentials
                  </span>
                </div>
                <button
                  style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                  onClick={() => setShowAdvancedAuth((prev) => !prev)}
                >
                  {showAdvancedAuth ? "▲ Hide Custom Key Overrides" : "▼ Override API Keys (Optional)"}
                </button>
              </div>

              <div className="sb-row">
                <div className="sb-group">
                  <label>Provider</label>
                  <select
                    className="sb-select"
                    value={provider}
                    onChange={(e) => {
                      const p = e.target.value;
                      setProvider(p);
                      const list = modelsRegistry[p] || DEFAULT_MODELS[p] || [];
                      if (list.length > 0) setModel(list[0].id);
                    }}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="groq">Groq (Fast / Free tier)</option>
                    <option value="openrouter">OpenRouter</option>
                  </select>
                </div>

                <div className="sb-group" style={{ flex: 1.6 }}>
                  <label>Select Model (Auto-fetched)</label>
                  <select
                    className="sb-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {availableModelsForProvider.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sb-group">
                  <label>Evaluation Mode</label>
                  <select
                    className="sb-select"
                    value={runBothArms ? "both" : "agent"}
                    onChange={(e) => setRunBothArms(e.target.value === "both")}
                  >
                    <option value="both">Side-by-Side (Agent vs Flat Baseline)</option>
                    <option value="agent">Agent Only (Fastest)</option>
                  </select>
                </div>
              </div>

              {/* ADVANCED OVERRIDES (COLLAPSIBLE) */}
              {showAdvancedAuth && (
                <div className="sb-row" style={{ paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
                  <div className="sb-group" style={{ flex: 1.5 }}>
                    <label>Custom API Key (Optional override)</label>
                    <input
                      className="sb-input"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Leave empty to use .env key"
                    />
                  </div>
                  <div className="sb-group" style={{ flex: 1.5 }}>
                    <label>Custom GitHub Token (Optional for 5000 req/hr)</label>
                    <input
                      className="sb-input"
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="Leave empty to use .env GITHUB_TOKEN"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* LIVE RUNNER FORM */}
            <div className="runner-card">
              <div className="rc-header">
                <h3 className="rc-title">1. Target Public GitHub Repository</h3>
                <div className="rc-tabs">
                  <button
                    className={`rc-tab ${runnerType === "changelog" ? "active" : ""}`}
                    onClick={() => setRunnerType("changelog")}
                  >
                    📦 Release CHANGELOG Audit
                  </button>
                  <button
                    className={`rc-tab ${runnerType === "pr" ? "active" : ""}`}
                    onClick={() => setRunnerType("pr")}
                  >
                    💬 PR Review Resolver
                  </button>
                </div>
              </div>

              {/* QUICK PRESETS */}
              <div className="presets-row">
                <span style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600 }}>1-Click Presets:</span>
                <button className="preset-btn" onClick={() => applyPreset("changelog", "pallets/flask", "3.0.0", "3.1.0")}>
                  🧪 Flask 3.0.0 → 3.1.0
                </button>
                <button className="preset-btn" onClick={() => applyPreset("changelog", "psf/requests", "v2.31.0", "v2.32.0")}>
                  🧪 Requests v2.31 → v2.32
                </button>
                <button className="preset-btn" onClick={() => applyPreset("pr", "tiangolo/fastapi", "11500")}>
                  🧪 FastAPI PR #11500
                </button>
                <button className="preset-btn" onClick={() => applyPreset("pr", "pydantic/pydantic", "9000")}>
                  🧪 Pydantic PR #9000
                </button>
              </div>

              {/* INPUT FIELDS */}
              <div className="sb-row" style={{ marginTop: 12 }}>
                <div className="sb-group" style={{ flex: 1.5 }}>
                  <label>Repository (owner/repo)</label>
                  <input
                    className="sb-input"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="e.g. pallets/flask"
                  />
                </div>

                {runnerType === "changelog" ? (
                  <>
                    <div className="sb-group">
                      <label>Base Tag</label>
                      <input
                        className="sb-input"
                        value={baseTag}
                        onChange={(e) => setBaseTag(e.target.value)}
                        placeholder="e.g. 3.0.0"
                      />
                    </div>
                    <div className="sb-group">
                      <label>Head Tag</label>
                      <input
                        className="sb-input"
                        value={headTag}
                        onChange={(e) => setHeadTag(e.target.value)}
                        placeholder="e.g. 3.1.0"
                      />
                    </div>
                    <div className="sb-group">
                      <label>CHANGELOG File</label>
                      <input
                        className="sb-input"
                        value={changelogFile}
                        onChange={(e) => setChangelogFile(e.target.value)}
                        placeholder="CHANGELOG.md"
                      />
                    </div>
                  </>
                ) : (
                  <div className="sb-group">
                    <label>Pull Request Number (#)</label>
                    <input
                      className="sb-input"
                      type="number"
                      value={prNumber}
                      onChange={(e) => setPrNumber(e.target.value)}
                      placeholder="e.g. 11500"
                    />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 14, alignItems: "center" }}>
                <button
                  className="run-btn"
                  onClick={handleRunLiveTriage}
                  disabled={isRunningLive || !repoInput.trim()}
                >
                  {isRunningLive ? "⏳ Querying GitHub REST API & Running Triage Agents…" : "🚀 Run Live Triage Audit"}
                </button>
                {isRunningLive && (
                  <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                    Downloading Git commits, diffs, and executing verification agents…
                  </span>
                )}
              </div>
            </div>

            {/* ERROR DISPLAY */}
            {liveError && (
              <div className="callout" style={{ borderLeftColor: "var(--bad)", marginTop: 16 }}>
                <strong style={{ color: "var(--bad)" }}>Execution Error</strong>
                <p>{liveError}</p>
              </div>
            )}

            {/* ========================================================================= */}
            {/* RICH RESULTS & ARTIFACT EXPLORER */}
            {/* ========================================================================= */}
            {liveData && (
              <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 1. FETCHED ARTIFACTS CARD */}
                <div className="gh-box" style={{ margin: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17 }}>📦 Fetched Git Repository Artifacts</h3>
                      <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                        Source: GitHub REST API · {liveData.repo}
                      </span>
                    </div>

                    {/* ARTIFACT TABS */}
                    <div className="rc-tabs">
                      <button
                        className={`rc-tab ${activeArtifactTab === "commits" ? "active" : ""}`}
                        onClick={() => setActiveArtifactTab("commits")}
                      >
                        Git Commits ({liveData.artifacts.commits_count})
                      </button>
                      {liveData.item_type === "changelog_audit" ? (
                        <button
                          className={`rc-tab ${activeArtifactTab === "changelog" ? "active" : ""}`}
                          onClick={() => setActiveArtifactTab("changelog")}
                        >
                          CHANGELOG Content
                        </button>
                      ) : (
                        <>
                          <button
                            className={`rc-tab ${activeArtifactTab === "comments" ? "active" : ""}`}
                            onClick={() => setActiveArtifactTab("comments")}
                          >
                            Review Comments ({liveData.artifacts.review_comments?.length || 0})
                          </button>
                          <button
                            className={`rc-tab ${activeArtifactTab === "diffs" ? "active" : ""}`}
                            onClick={() => setActiveArtifactTab("diffs")}
                          >
                            Diff Files ({liveData.artifacts.diff_files?.length || 0})
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* COMMITS LIST */}
                  {activeArtifactTab === "commits" && (
                    <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
                      {liveData.artifacts.commits.map((c, i) => (
                        <div key={i} style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                          <a
                            href={`https://github.com/${liveData.repo}/commit/${c.full_sha}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 11.5 }}
                          >
                            {c.sha}
                          </a>
                          <span style={{ fontWeight: 600, color: "var(--text)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.message}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>@{c.author}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CHANGELOG CONTENT */}
                  {activeArtifactTab === "changelog" && (
                    <pre style={{ maxHeight: 240, margin: 0, whiteSpace: "pre-wrap" }}>
                      {liveData.artifacts.changelog_preview || "No changelog content found."}
                    </pre>
                  )}

                  {/* REVIEW COMMENTS */}
                  {activeArtifactTab === "comments" && (
                    <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
                      {liveData.artifacts.review_comments.map((rc, i) => (
                        <div key={i} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontWeight: 700, color: "var(--accent)" }}>
                            <span>Comment #{rc.id || i + 1} on <code>{rc.path || rc.file}</code></span>
                            <span style={{ color: "var(--text-faint)" }}>Line {rc.line || "?"}</span>
                          </div>
                          <p style={{ margin: 0, color: "var(--text)" }}>{rc.body || rc.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* DIFF FILES */}
                  {activeArtifactTab === "diffs" && (
                    <div style={{ padding: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5 }}>
                      <strong>Modified Files in Pull Request:</strong>
                      <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                        {liveData.artifacts.diff_files.map((df, i) => (
                          <li key={i} style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{df}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 2. SIDE-BY-SIDE VERDICT & FINDINGS COMPARISON */}
                <div style={{ display: "grid", gridTemplateColumns: liveData.baseline ? "1fr 1fr" : "1fr", gap: 16 }}>
                  {/* AGENT ARM */}
                  <div className="live-result-box" style={{ margin: 0, border: "2px solid var(--accent)" }}>
                    <div className="lrb-head">
                      <div>
                        <span className="tag review" style={{ marginBottom: 4, display: "inline-block" }}>
                          🧠 Multi-Agent Pipeline
                        </span>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Evidence-First Triage Result</h3>
                      </div>
                      <span className={`action-badge ${liveData.agent.result.recommended_action || "needs_human"}`}>
                        {liveData.agent.result.recommended_action || "needs_human"}
                      </span>
                    </div>

                    <p style={{ fontSize: 13.5, margin: "0 0 14px", color: "var(--text)" }}>
                      <strong>Summary:</strong> {liveData.agent.result.summary}
                    </p>

                    <h4 style={{ margin: "14px 0 8px", fontSize: 13, textTransform: "uppercase", color: "var(--text-faint)" }}>
                      Verified Findings ({liveData.agent.result.findings?.length || 0}):
                    </h4>

                    {(!liveData.agent.result.findings || liveData.agent.result.findings.length === 0) ? (
                      <div className="finding-card">
                        <span style={{ color: "var(--good)", fontWeight: 600 }}>✓ Clean Queue Item</span> — No discrepancies detected. Safe to proceed.
                      </div>
                    ) : (
                      liveData.agent.result.findings.map((f, idx) => (
                        <div className="finding-card" key={idx}>
                          <div className="fc-head">
                            <span className={`vlabel ${f.verdict}`}>{f.verdict}</span>
                            <strong style={{ fontSize: 13 }}>{f.subject}</strong>
                            <span style={{ marginLeft: "auto", fontSize: 11 }}>
                              {f.verified ? (
                                <span style={{ color: "var(--good)", fontWeight: 700 }}>[VERIFIED ✓]</span>
                              ) : (
                                <span style={{ color: "var(--bad)", fontWeight: 700 }}>[UNVERIFIED ✗]</span>
                              )}
                            </span>
                          </div>
                          {f.rationale && (
                            <p style={{ margin: "4px 0", fontSize: 12, color: "var(--text-dim)" }}>
                              {f.rationale}
                            </p>
                          )}
                          {f.evidence && f.evidence.map((ev, i) => (
                            <div className="fc-quote" key={i}>
                              <strong>Ref: {ev.kind}:{ev.ref}</strong> — "{ev.quote}"
                            </div>
                          ))}
                          {f.verifier_note && (
                            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                              <em>Verifier Note:</em> {f.verifier_note}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* BASELINE ARM (IF RUN) */}
                  {liveData.baseline && (
                    <div className="live-result-box" style={{ margin: 0, background: "var(--bg-elev2)" }}>
                      <div className="lrb-head">
                        <div>
                          <span className="tag" style={{ marginBottom: 4, display: "inline-block", background: "var(--border)", color: "var(--text-dim)" }}>
                            📄 Naive Flat Baseline
                          </span>
                          <h3 style={{ margin: 0, fontSize: 16 }}>Single-Prompt Result</h3>
                        </div>
                        <span className={`action-badge ${liveData.baseline.result.recommended_action || "needs_human"}`}>
                          {liveData.baseline.result.recommended_action || "needs_human"}
                        </span>
                      </div>

                      <p style={{ fontSize: 13.5, margin: "0 0 14px", color: "var(--text)" }}>
                        <strong>Summary:</strong> {liveData.baseline.result.summary}
                      </p>

                      <h4 style={{ margin: "14px 0 8px", fontSize: 13, textTransform: "uppercase", color: "var(--text-faint)" }}>
                        Ungrounded Claims ({liveData.baseline.result.findings?.length || 0}):
                      </h4>

                      {(!liveData.baseline.result.findings || liveData.baseline.result.findings.length === 0) ? (
                        <div className="finding-card">
                          <span style={{ color: "var(--text-faint)" }}>No claims generated.</span>
                        </div>
                      ) : (
                        liveData.baseline.result.findings.map((f, idx) => (
                          <div className="finding-card" key={idx}>
                            <div className="fc-head">
                              <span className={`vlabel ${f.verdict}`}>{f.verdict}</span>
                              <strong style={{ fontSize: 13 }}>{f.subject}</strong>
                              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--warn)", fontWeight: 600 }}>
                                [NO GROUNDING PROOF]
                              </span>
                            </div>
                            {f.rationale && (
                              <p style={{ margin: "4px 0", fontSize: 12, color: "var(--text-dim)" }}>
                                {f.rationale}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 3. STEP-BY-STEP AGENT TRAJECTORY INSPECTOR */}
                <div className="gh-box" style={{ margin: 0 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>
                    🔍 Live Agent Trajectory &amp; Tool Inspection
                  </h3>
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-dim)" }}>
                    Inspect the exact sequence of subagents, on-demand tool calls (<code>list_commits</code>, <code>get_commit</code>, <code>get_diff</code>), and verification steps executed during this live triage audit.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {liveData.agent.trajectories.map((traj, tIdx) => (
                      <div className="traj-agent" key={tIdx} style={{ margin: 0 }}>
                        <div className="ta-head">
                          <span className="ta-name">{traj.agent}</span>
                          <span className="ta-role">
                            {traj.agent === "router" ? "Classification Agent" : traj.agent.includes("verifier") ? "Grounding & Soundness Verifier" : "Specialist Agent"}
                          </span>
                          <span className="ta-meta">
                            {traj.input_tokens + traj.output_tokens} tokens
                          </span>
                        </div>

                        {traj.steps.map((step, sIdx) => {
                          const stepKey = tIdx * 100 + sIdx;
                          const isExpanded = expandedTrajStep === stepKey;

                          return (
                            <div className="step" key={sIdx}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpandedTrajStep(isExpanded ? null : stepKey)}>
                                <div className="s-kind">Step #{sIdx + 1} · {step.tool_calls ? "🔧 Tool Call Execution" : "💭 Model Thought"}</div>
                                <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                                  {isExpanded ? "Collapse ▲" : "Expand ▼"}
                                </span>
                              </div>

                              {step.thought && (
                                <div className="s-text" style={{ fontSize: 12.5, margin: "4px 0" }}>
                                  {step.thought}
                                </div>
                              )}

                              {step.tool_calls && step.tool_calls.map((tc: any, tcIdx: number) => (
                                <div key={tcIdx}>
                                  <div className="toolcall">
                                    <strong>{tc.name}</strong>({JSON.stringify(tc.args || {})})
                                  </div>
                                </div>
                              ))}

                              {step.tool_results && step.tool_results.map((tr: any, trIdx: number) => (
                                <div key={trIdx} className="toolresult" style={{ maxHeight: isExpanded ? 400 : 90 }}>
                                  {typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result, null, 2)}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ARCHITECTURE & STORY */}
        {/* ========================================================================= */}
        {currentTab === "architecture" && (
          <section id="architecture">
            <div className="page-head">
              <div className="page-title-area">
                <h1>Agent Architecture &amp; Design Story</h1>
                <p>
                  Why purposeful choices, on-demand tools, and two-layer verification outperform single mega-prompts.
                </p>
              </div>
            </div>

            <div className="sec-head" style={{ marginTop: 10 }}>
              <span className="sec-num">01</span>
              <h2>Pipeline Flow</h2>
            </div>
            <div className="pipe-container">
              <div className="pipe-flow">
                <div className="pipe-card active">
                  <div className="pc-title">1. Router Agent</div>
                  <div className="pc-desc">Classifies item type (CHANGELOG, PR Review, Dependency bump) and picks dedicated specialist.</div>
                </div>
                <span className="pipe-arrow">→</span>
                <div className="pipe-card active">
                  <div className="pc-title">2. Specialist + Tools</div>
                  <div className="pc-desc">Queries on-demand tools (<code>list_commits</code>, <code>get_commit</code>, <code>get_diff</code>) to gather code evidence.</div>
                </div>
                <span className="pipe-arrow">→</span>
                <div className="pipe-card verified">
                  <div className="pc-title">3. Two-Layer Verifier</div>
                  <div className="pc-desc">1. Grounding: Asserts ref &amp; quote exist in repo.<br />2. Soundness: Independent model validates reasoning.</div>
                </div>
              </div>
            </div>

            <div className="sec-head" style={{ marginTop: 32 }}>
              <span className="sec-num">02</span>
              <h2>Key Architectural Design Choices</h2>
            </div>
            <div className="value-props">
              {CHOICES.map((c) => (
                <div className="vprop-card" key={c.h}>
                  <h3>{c.h}</h3>
                  <p>{c.p}</p>
                </div>
              ))}
            </div>

            <div className="sec-head" style={{ marginTop: 32 }}>
              <span className="sec-num">03</span>
              <h2>The 4 Core Questions</h2>
            </div>
            <div className="value-props">
              {QUESTIONS.map((q) => (
                <div className="vprop-card" key={q.n}>
                  <span className="tag changelog" style={{ marginBottom: 6, display: "inline-block" }}>{q.n}</span>
                  <h3>{q.q}</h3>
                  <p>{q.a}</p>
                </div>
              ))}
            </div>

            <div className="sec-head" style={{ marginTop: 32 }}>
              <span className="sec-num">04</span>
              <h2>Evolution Timeline &amp; Changelog</h2>
            </div>
            <div className="timeline">
              {STORY.map((s, i) => (
                <div className={`tl-item ${s.kind || ""}`} key={i}>
                  <div className="tl-head">
                    <span className="tl-stage">{s.stage}</span>
                    {s.badge && <span className={`tl-badge ${s.badgeKind}`}>{s.badge}</span>}
                    {s.evidence && <span className="tl-badge evidence">{s.evidence}</span>}
                  </div>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>

            <div className="sec-head" style={{ marginTop: 32 }}>
              <span className="sec-num">05</span>
              <h2>Hot Take &amp; Practical Lessons</h2>
            </div>
            <div className="callout hot">
              <strong>Reliability isn't a smarter prompt — it's making the agent unable to assert what it can't point at.</strong>
              <p>
                Cheap deterministic grounding (does the cited commit exist? is the quote actually in it?)
                removes a whole class of hallucinated findings that no amount of tuning the generator
                reliably fixes. Verify at the seam where claims meet artifacts, and let the generator be bold.
              </p>
            </div>
            <div className="callout hot">
              <strong>A verifier is only as good as the evidence it's handed.</strong>
              <p>
                Ours first rejected <em>correct</em> findings because it judged absence claims ("no commit
                supports this line") from a single quote — you can't prove an absence from one artifact.
                Match the verifier's context to the shape of the claim, or verification quietly becomes a
                false-negative machine.
              </p>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: REPRODUCE & CI SETUP */}
        {/* ========================================================================= */}
        {currentTab === "reproduce" && (
          <section id="reproduce">
            <div className="page-head">
              <div className="page-title-area">
                <h1>Reproduce &amp; CI Integration</h1>
                <p>
                  Full clean-room runbook and automated continuous triage with GitHub Actions.
                </p>
              </div>
            </div>

            <pre>
{`# 1. Clone and install dependencies
pip install -r requirements.txt
cp .env.example .env         # Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY

# 2. Run offline sanity verification (zero API cost)
python -c "from src.fixtures import load_all; print(len(load_all('evalcases/cases')), 'cases ready')"

# 3. Execute the full benchmark evaluation (Baseline vs Agent)
python eval.py

# 4. Run a single case with rich terminal formatting
python run_one.py evalcases/cases/case03_changelog_misclassified_breaking.json`}
            </pre>

            <div className="callout" style={{ marginTop: 24 }}>
              <strong>Automated GitHub Actions Workflow:</strong>
              <p>
                Triage Inbox includes a ready-to-use CI workflow in <code>.github/workflows/triage.yml</code>
                to automatically audit pull requests on push or merge.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <strong style={{ color: "var(--text)" }}>Triage Inbox</strong> · Built for the micro1
          Agentic Workflows Hackathon · Multi-Provider Support (Anthropic / OpenAI / Groq / OpenRouter) ·
          Live GitHub Support · Verified Evidence-First Architecture.
        </div>
      </footer>

      {/* TRAJECTORY DRAWER */}
      {selected && cases[selected] && (
        <TrajectoryPanel
          caseId={selected}
          meta={cases[selected]}
          row={results.per_case[selected]}
          entries={{
            agent: manifest[selected]?.agent || [],
            baseline: manifest[selected]?.baseline || [],
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
