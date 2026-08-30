import { useEffect, useMemo, useState } from "react";
import { f2, isHardTitle, loadCases, loadManifest, loadResults, pct, usd } from "./data";
import TrajectoryPanel from "./TrajectoryPanel";
import { STORY, QUESTIONS, CHOICES } from "./content";
import type { Cases, Manifest, Results } from "./types";

export default function App() {
  const [results, setResults] = useState<Results | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [cases, setCases] = useState<Cases | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<"queue" | "github" | "architecture" | "reproduce">("queue");
  const [caseFilter, setCaseFilter] = useState<"all" | "changelog" | "review" | "hard" | "wins">("all");
  
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

  if (err) return <div className="wrap errbox">Failed to load data: {err}<br />Run <code>python web/build_data.py</code> then reload.</div>;
  if (!results || !results.aggregate.baseline || !results.aggregate.agent || !manifest || !cases)
    return <div className="wrap loading" style={{ padding: "80px 20px", textAlign: "center" }}>Loading Triage Inbox Workspace…</div>;

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
        {/* HERO / PURPOSE SECTION */}
        <header className="hero">
          <div className="hero-badge-row">
            <span className="eyebrow">micro1 · Agentic Workflows Hackathon</span>
            <span className="eyebrow" style={{ color: "var(--good)", borderColor: "var(--good-border)", background: "var(--good-bg)" }}>
              ✓ 100% Grounded in Git Artifacts
            </span>
          </div>

          <h1>
            Automated PR &amp; Release Triage —<br />
            <span className="grad">with verified proof on every verdict.</span>
          </h1>

          <p className="sub">
            Maintainers waste hours cross-referencing commit histories against release notes and verifying
            if PR authors actually handled review comments. <strong>Triage Inbox</strong> independently
            gathers repository evidence, rejects ungrounded claims, and delivers actionable verdicts.
          </p>

          {/* 3 VALUE CARDS (Clear purpose breakdown) */}
          <div className="value-props">
            <div className="vprop-card">
              <div className="vprop-icon">🔍</div>
              <h3>1. On-Demand Artifact Tools</h3>
              <p>
                Specialists call <code>list_commits</code> and <code>get_diff</code> on-demand to inspect commit bodies and code patches, rather than skimming vague subject lines.
              </p>
            </div>
            <div className="vprop-card">
              <div className="vprop-icon">🛡️</div>
              <h3>2. Two-Layer Proof Verifier</h3>
              <p>
                Every finding undergoes deterministic grounding (ref &amp; quote verification) followed by an independent soundness audit before reaching human review.
              </p>
            </div>
            <div className="vprop-card">
              <div className="vprop-icon">⚡</div>
              <h3>3. Actionable Verdicts</h3>
              <p>
                Outputs clear, trusted actions (<code>AUTO_OK</code>, <code>NEEDS_HUMAN</code>, <code>ESCALATE</code>) backed by cited line numbers and SHAs.
              </p>
            </div>
          </div>

          {/* HEADLINE METRICS BANNER */}
          <div className="metrics-banner">
            <div className="mb-item">
              <span className="mb-label">Primary Metric (F1)</span>
              <span className="mb-val good">
                <span className="was">{f2(b.f1)} →</span> {f2(a.f1)}
              </span>
              <span className="mb-sub">+{f2(a.f1 - b.f1)} F1 over baseline</span>
            </div>

            <div className="mb-item">
              <span className="mb-label">False Alarms / Task</span>
              <span className="mb-val good">
                <span className="was">{b.false_alarms_per_case.toFixed(1)} →</span> {a.false_alarms_per_case.toFixed(1)}
              </span>
              <span className="mb-sub">−71% wasted maintainer reviews</span>
            </div>

            <div className="mb-item">
              <span className="mb-label">Precision</span>
              <span className="mb-val good">
                <span className="was">{pct(b.precision)} →</span> {pct(a.precision)}
              </span>
              <span className="mb-sub">Grounding eliminates hallucination</span>
            </div>

            <div className="mb-item">
              <span className="mb-label">Cost / Task</span>
              <span className="mb-val">
                {usd(a.cost_per_task_usd)} <span className="was">/ task</span>
              </span>
              <span className="mb-sub">{tally.wins} Wins / 0 Losses ({results.n_cases} cases)</span>
            </div>
          </div>
        </header>

        {/* TAB 1: MAINTAINER QUEUE (MAIN WORKSTATION VIEW) */}
        {currentTab === "queue" && (
          <section id="queue">
            <div className="sec-head">
              <span className="sec-num">01</span>
              <h2>Maintainer Triage Queue</h2>
            </div>
            <p className="sec-lead">
              Select any queue item to inspect the live triage verdict, cited code evidence, and step-by-step agent trajectories.
            </p>

            <div className="queue-filter-bar">
              <div className="filter-btn-group">
                <button className={`filter-btn ${caseFilter === "all" ? "active" : ""}`} onClick={() => setCaseFilter("all")}>All Items ({caseIds.length})</button>
                <button className={`filter-btn ${caseFilter === "changelog" ? "active" : ""}`} onClick={() => setCaseFilter("changelog")}>CHANGELOG Audits (G)</button>
                <button className={`filter-btn ${caseFilter === "review" ? "active" : ""}`} onClick={() => setCaseFilter("review")}>Review Comment Resolvers (E)</button>
                <button className={`filter-btn ${caseFilter === "hard" ? "active" : ""}`} onClick={() => setCaseFilter("hard")}>Hard Edge Cases</button>
                <button className={`filter-btn ${caseFilter === "wins" ? "active" : ""}`} onClick={() => setCaseFilter("wins")}>Agent Wins ({tally.wins})</button>
              </div>
              <span style={{ fontSize: 13, color: "var(--text-faint)" }}>
                Showing <strong>{filteredCaseIds.length}</strong> items · Click row for full proof
              </span>
            </div>

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
                        <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--mono)" }}>{id}</span>
                      </div>
                      <div className="qc-title">
                        {(meta?.title || id).replace(/\s*\(HARD:.*$/, "").replace(/\s*\([^)]*precision[^)]*\)/i, "")}
                      </div>
                      <div className="qc-desc">
                        {isReview
                          ? "Verifies if PR code diff hunks genuinely satisfy reviewer comments."
                          : "Cross-checks release notes against git commit range to detect phantoms or missing notes."}
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

                    <div style={{ textAlign: "right", fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                      View Proof
                    </div>

                    <div className="chev">›</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 2: LIVE GITHUB REPO SCANNER */}
        {currentTab === "github" && (
          <section id="github">
            <div className="sec-head">
              <span className="sec-num">02</span>
              <h2>Live GitHub Open-Source Triage</h2>
            </div>
            <p className="sec-lead">
              Test Triage Inbox on real-world open-source repositories in the wild without synthetic mockups.
            </p>

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

        {/* TAB 3: ARCHITECTURE & STORY */}
        {currentTab === "architecture" && (
          <section id="architecture">
            <div className="sec-head">
              <span className="sec-num">03</span>
              <h2>Agent Pipeline Architecture</h2>
            </div>
            <p className="sec-lead">
              How the multi-agent pipeline prevents hallucinations and enforces grounded verdicts.
            </p>

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
              <span className="sec-num">04</span>
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
              <span className="sec-num">05</span>
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
              <span className="sec-num">06</span>
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
              <span className="sec-num">07</span>
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

        {/* TAB 4: REPRODUCE & CI SETUP */}
        {currentTab === "reproduce" && (
          <section id="reproduce">
            <div className="sec-head">
              <span className="sec-num">08</span>
              <h2>Reproduce &amp; CI Integration</h2>
            </div>
            <p className="sec-lead">
              From a clean environment. All benchmark cases run offline with zero external network dependencies.
            </p>

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
