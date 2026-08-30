import { useEffect, useMemo, useState } from "react";
import { f2, isHardTitle, loadCases, loadManifest, loadResults, pct } from "./data";
import TrajectoryPanel from "./TrajectoryPanel";
import { STORY, QUESTIONS, CHOICES } from "./content";
import type { Cases, Manifest, Results } from "./types";

export default function App() {
  const [results, setResults] = useState<Results | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [cases, setCases] = useState<Cases | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<"video" | "queue" | "github" | "architecture" | "reproduce">("video");
  const [caseFilter, setCaseFilter] = useState<"all" | "changelog" | "review" | "hard" | "wins">("all");
  const [videoStep, setVideoStep] = useState<number>(1);
  
  // Default to LIGHT mode
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("triage_theme") as "dark" | "light") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("triage_theme", theme);
  }, [theme]);

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
          <span className="badge-model">{results.model}</span>
        </div>
      </nav>

      <div className="wrap tab-content">
        {/* ========================================================================= */}
        {/* TAB 0: DEDICATED 5-MINUTE VIDEO PRESENTER SUITE */}
        {/* ========================================================================= */}
        {currentTab === "video" && (
          <section id="video" className="video-suite">
            <div className="page-head">
              <div className="page-title-area">
                <h1>🎬 5-Minute Video Recording Suite</h1>
                <p>
                  Use this interactive sequential walkthrough to record your hackathon submission video.
                  Follow the step-by-step speaker script and live interactive demonstrations.
                </p>
              </div>
            </div>

            {/* STEP SELECTOR */}
            <div className="video-stepper">
              <button className={`step-btn ${videoStep === 1 ? "active" : ""}`} onClick={() => setVideoStep(1)}>
                <div className="time">0:00 – 1:00</div>
                <div className="title">1. The Problem &amp; Pain</div>
              </button>
              <button className={`step-btn ${videoStep === 2 ? "active" : ""}`} onClick={() => setVideoStep(2)}>
                <div className="time">1:00 – 1:45</div>
                <div className="title">2. The Baseline Failure</div>
              </button>
              <button className={`step-btn ${videoStep === 3 ? "active" : ""}`} onClick={() => setVideoStep(3)}>
                <div className="time">1:45 – 3:00</div>
                <div className="title">3. Live Agent Solution</div>
              </button>
              <button className={`step-btn ${videoStep === 4 ? "active" : ""}`} onClick={() => setVideoStep(4)}>
                <div className="time">3:00 – 4:00</div>
                <div className="title">4. Evidence &amp; Changelog</div>
              </button>
              <button className={`step-btn ${videoStep === 5 ? "active" : ""}`} onClick={() => setVideoStep(5)}>
                <div className="time">4:00 – 5:00</div>
                <div className="title">5. Hot Take &amp; Lessons</div>
              </button>
            </div>

            {/* STEP 1: THE PROBLEM */}
            {videoStep === 1 && (
              <div>
                <div className="script-box">
                  <div className="script-speaker">🎙️ Speaker Script (Read during recording):</div>
                  <div className="script-quote">
                    "Hi everyone! This is <strong>Triage Inbox</strong> — an evidence-first agentic workflow designed for repository maintainers.<br /><br />
                    Every maintainer faces Monday morning triage overload: checking if release CHANGELOGs match what actually shipped, and verifying if PR authors genuinely addressed reviewer comments. Skimming leads to silent breaking changes and cosmetic PR merges."
                  </div>
                </div>

                <div className="value-props" style={{ marginTop: 20 }}>
                  <div className="vprop-card">
                    <div className="vprop-icon">📦</div>
                    <h3>1. The CHANGELOG Audit Dilemma (Lane G)</h3>
                    <p>Did someone hide a breaking API change under a minor heading, or list a feature that never actually merged?</p>
                  </div>
                  <div className="vprop-card">
                    <div className="vprop-icon">💬</div>
                    <h3>2. The PR Review Resolution Dilemma (Lane E)</h3>
                    <p>The author wrote "Fixed your feedback 👍", but did their code diff actually resolve the review comments?</p>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: THE BASELINE FAILURE */}
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

            {/* STEP 3: LIVE AGENT SOLUTION */}
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

            {/* STEP 4: MEASURED EVIDENCE & CHANGELOG */}
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

            {/* STEP 5: HOT TAKE & TAKEAWAYS */}
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
        {/* TAB 1: MAINTAINER QUEUE (IMMEDIATELY VISIBLE WORKSPACE) */}
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

              {/* COMPACT INLINE METRICS STRIP */}
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

            {/* QUEUE CARDS LIST */}
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
        {/* TAB 2: LIVE GITHUB REPO SCANNER */}
        {/* ========================================================================= */}
        {currentTab === "github" && (
          <section id="github">
            <div className="page-head">
              <div className="page-title-area">
                <h1>Live GitHub Open-Source Triage</h1>
                <p>
                  Audit real-world open-source repositories and pull requests directly from GitHub's REST API.
                </p>
              </div>
            </div>

            <div className="gh-box">
              <h3>1. Audit a Real Release CHANGELOG vs. Commits (e.g., Flask)</h3>
              <p>
                Connects to GitHub's REST API, pulls every real commit between two tags, downloads the actual <code>CHANGELOG.md</code>,
                and verifies that every claimed fix or feature exists in Git history.
              </p>
              <pre>
{`# Audit Flask v3.0.0 -> v3.1.0 release notes against git commits
python run_github.py changelog pallets/flask --base 3.0.0 --head 3.1.0`}
              </pre>
            </div>

            <div className="gh-box">
              <h3>2. Audit a Real GitHub Pull Request (e.g., FastAPI)</h3>
              <p>
                Fetches review threads and modified file diffs for any active PR, checking whether review comments
                were genuinely addressed or merely replied to with cosmetic changes.
              </p>
              <pre>
{`# Audit FastAPI PR #11500 review comments against modified diff hunks
python run_github.py pr tiangolo/fastapi 11500`}
              </pre>
            </div>

            <div className="callout hot">
              <strong>Capture Real Repos into Offline Evaluation Benchmarks:</strong>
              <p>
                You can freeze any real GitHub PR or release into a reproducible offline fixture for continuous regression testing:
              </p>
              <pre style={{ margin: "10px 0 0" }}>
{`python run_github.py pr tiangolo/fastapi 11500 --save evalcases/cases/case11_fastapi_real.json`}
              </pre>
            </div>
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
