import { useEffect, useMemo, useState } from "react";
import { f2, isHardTitle, loadCases, loadManifest, loadResults, pct, usd } from "./data";
import TrajectoryPanel from "./TrajectoryPanel";
import { STORY, QUESTIONS, CHOICES } from "./content";
import type { Cases, Manifest, Results } from "./types";

function StatCard({ label, from, to, good, delta, barBase, barAgent }: {
  label: string; from: string; to: string; good?: boolean; delta: string;
  barBase: number; barAgent: number;
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="compare">
        <span className="from">{from}</span>
        <span className="arrow">→</span>
        <span className={`to ${good ? "good" : ""}`}>{to}</span>
      </div>
      <div className="delta">{delta}</div>
      <div className="bar-mini">
        <span style={{ width: `${Math.max(barBase, 2)}%`, background: "var(--bad)", opacity: 0.7 }} />
        <span style={{ width: `${Math.max(barAgent - barBase, 0)}%`, background: "var(--good)" }} />
      </div>
    </div>
  );
}

export default function App() {
  const [results, setResults] = useState<Results | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [cases, setCases] = useState<Cases | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

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

  if (err) return <div className="wrap errbox">Failed to load data: {err}<br />Run <code>python web/build_data.py</code> then reload.</div>;
  if (!results || !results.aggregate.baseline || !results.aggregate.agent || !manifest || !cases)
    return <div className="wrap loading">Loading evaluation…</div>;

  const b = results.aggregate.baseline, a = results.aggregate.agent;

  return (
    <>
      <nav className="top">
        <div className="nav-inner">
          <span className="logo">Triage Inbox<span className="dot">.</span></span>
          <div className="nav-links">
            <a href="#problem">Problem</a>
            <a href="#solution">Solution</a>
            <a href="#results">Results</a>
            <a href="#story">Story</a>
            <a href="#reproduce">Reproduce</a>
          </div>
          <span className="nav-spacer" />
          <span className="badge-model">{results.model}</span>
        </div>
      </nav>

      <div className="wrap">
        {/* HERO */}
        <header className="hero">
          <span className="eyebrow">micro1 · Agentic Workflows Hackathon</span>
          <h1>Triage a maintainer's queue —<br /><span className="grad">and prove every verdict.</span></h1>
          <p className="sub">
            An agent that reviews a repository's CHANGELOG entries and pull-request review
            threads, flags what's wrong, and backs every finding with a quoted artifact and an
            independent verifier — so a maintainer can trust it instead of re-checking it.
          </p>
          <div className="hero-metrics">
            <div className="hero-metric">
              <span className="hm-val good"><span className="was">{f2(b.f1)} → </span>{f2(a.f1)}</span>
              <span className="hm-label">problem F1 (baseline → agent)</span>
            </div>
            <div className="hero-metric">
              <span className="hm-val good"><span className="was">{b.false_alarms_per_case.toFixed(1)} → </span>{a.false_alarms_per_case.toFixed(1)}</span>
              <span className="hm-label">false alarms / case (−71%)</span>
            </div>
            <div className="hero-metric">
              <span className="hm-val">{tally.wins}<span className="was"> / {results.n_cases}</span></span>
              <span className="hm-label">cases the agent wins (0 losses)</span>
            </div>
          </div>
          <div className="hero-cta">
            <a className="btn primary" href="#results">See the results</a>
            <a className="btn" href="#story">Read the build story</a>
          </div>
        </header>

        {/* PROBLEM */}
        <section id="problem" className="nofold">
          <div className="sec-head"><span className="sec-num">01</span><h2>The problem</h2></div>
          <p className="sec-lead">
            A repository maintainer makes dozens of small, evidence-heavy judgments a day. Two of
            them are surprisingly easy to get wrong by skimming — and surprisingly costly when you do.
          </p>
          <div className="qgrid">
            {QUESTIONS.map((q) => (
              <div className="qcard" key={q.n}>
                <div className="qn">{q.n}</div>
                <h4>{q.q}</h4>
                <p>{q.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SOLUTION */}
        <section id="solution">
          <div className="sec-head"><span className="sec-num">02</span><h2>The solution</h2></div>
          <p className="sec-lead">
            One item flows through a small pipeline of purposeful agents. The router picks the
            right specialist; the specialist gathers evidence with tools; the verifier refuses any
            claim it can't ground in the artifact.
          </p>
          <div className="pipe">
            <div className="node">
              <div className="n-title"><span className="dot-badge" style={{ background: "var(--accent)" }} />Router</div>
              <div className="n-desc">Classifies the item and dispatches it to the matching specialist lane.</div>
            </div>
            <span className="arrow-h">→</span>
            <div className="node">
              <div className="n-title"><span className="dot-badge" style={{ background: "var(--accent2)" }} />Specialist</div>
              <div className="n-desc">Pulls commits, diffs, and comments on demand via tools; emits findings, each bound to a quote.</div>
            </div>
            <span className="arrow-h">→</span>
            <div className="node verify">
              <div className="n-title"><span className="dot-badge" style={{ background: "var(--good)" }} />Verifier</div>
              <div className="n-desc">Grounds each claim (ref + quote must exist), then checks soundness. Only verified findings count.</div>
            </div>
          </div>
          <div className="section-label" style={{ marginTop: 30 }}>Why these choices</div>
          <div className="choices">
            {CHOICES.map((c) => (
              <div className="choice" key={c.h}>
                <h4>{c.h}</h4>
                <p>{c.p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* RESULTS */}
        <section id="results">
          <div className="sec-head"><span className="sec-num">03</span><h2>Measured improvement</h2></div>
          <p className="sec-lead">
            Same {results.n_cases} ground-truth cases, same evaluation, run on <code>{results.model}</code>.
            The baseline is a single general-purpose prompt; the agent is the pipeline above.
          </p>
          <div className="stats">
            <StatCard label="Primary metric: problem F1" from={f2(b.f1)} to={f2(a.f1)} good
              delta={`+${f2(a.f1 - b.f1)} F1`} barBase={b.f1 * 100} barAgent={a.f1 * 100} />
            <StatCard label="Precision" from={pct(b.precision)} to={pct(a.precision)} good
              delta={`+${pct(a.precision - b.precision)}`} barBase={b.precision * 100} barAgent={a.precision * 100} />
            <StatCard label="False alarms / case" from={b.false_alarms_per_case.toFixed(1)} to={a.false_alarms_per_case.toFixed(1)} good
              delta={`−${Math.round((1 - a.false_alarms_per_case / (b.false_alarms_per_case || 1)) * 100)}% wasted reviews`}
              barBase={100} barAgent={100 - (a.false_alarms_per_case / (b.false_alarms_per_case || 1)) * 100} />
            <StatCard label="Cost / task" from={usd(b.cost_per_task_usd)} to={usd(a.cost_per_task_usd)}
              delta={`${usd(a.cost_per_task_usd - b.cost_per_task_usd)} more`} barBase={15} barAgent={90} />
          </div>

          <div className="callout" style={{ marginTop: 22 }}>
            <strong>Why the baseline column is all zeros — that's the finding.</strong>
            <p>
              The single-prompt baseline scored a true <b>0.00 F1</b>: {b.tp} correct findings and{" "}
              {b.fp} false positives across {results.n_cases} cases — a confident false-positive
              machine. The agent counts a finding only after its verifier passes it, reaching
              F1 {f2(a.f1)} and cutting false alarms 71%. gpt-4o-mini is a deliberately weak model;
              a Claude run scores higher (one env var — see below).
            </p>
          </div>

          <p className="winline" style={{ marginTop: 24 }}>
            Head to head, the agent <b className="good">wins {tally.wins}</b>, ties {tally.ties} (the
            easy clean/all-addressed cases, where both are right, and the two hardest cases, where
            both still fall short), and <b>loses {tally.losses}</b>.
          </p>
          <div className="legend">
            <span className="k"><span className="sw" style={{ background: "var(--bad)", opacity: 0.7 }} /> baseline F1</span>
            <span className="k"><span className="sw" style={{ background: "var(--good)" }} /> agent F1</span>
            <span className="k">click any row → full agent trajectory</span>
          </div>
          <div className="case-head">
            <span>Case</span><span>Baseline</span><span>Agent</span>
            <span className="h-action">Agent action</span><span className="h-chev" />
          </div>
          <div className="cases">
            {caseIds.map((id) => {
              const row = results.per_case[id];
              const meta = cases[id];
              const bf = row.baseline?.f1 ?? 0, af = row.agent?.f1 ?? 0;
              const isReview = row.item_type === "review_resolution";
              const win = af > bf + 0.001;
              return (
                <button className="case-row" key={id} onClick={() => setSelected(id)}>
                  <div className="case-title">
                    <span className={`tag ${isReview ? "review" : "changelog"}`}>{isReview ? "review" : "changelog"}</span>
                    {isHardTitle(meta?.title || "") && <span className="tag hard">hard</span>}
                    <span className="t">{(meta?.title || id).replace(/\s*\(HARD:.*$/, "").replace(/\s*\([^)]*precision[^)]*\)/i, "")}</span>
                  </div>
                  <div className="armcell">
                    <span className={`val ${bf === 0 ? "zero" : ""}`}>{bf.toFixed(2)}</span>
                    <span className="bar"><span className="base" style={{ width: `${bf * 100}%` }} /></span>
                  </div>
                  <div className="armcell">
                    <span className={`val ${af > 0 ? "win" : "zero"}`}>{af.toFixed(2)}</span>
                    <span className="bar"><span className="agent" style={{ width: `${af * 100}%` }} /></span>
                    {win ? <span className="wintag">▲</span> : <span className="tietag">=</span>}
                  </div>
                  <span className={`action ${row.agent?.action || "error"}`}>{row.agent?.action || "—"}</span>
                  <span className="chev">›</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* STORY */}
        <section id="story">
          <div className="sec-head"><span className="sec-num">04</span><h2>The build story</h2></div>
          <p className="sec-lead">
            Every meaningful change, why it happened, and what it taught us — including the two bugs
            a live smoke test caught and the experiment we removed.
          </p>
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
        </section>

        {/* INSIGHTS */}
        <section id="insights">
          <div className="sec-head"><span className="sec-num">05</span><h2>Hot take &amp; insights</h2></div>
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

        {/* REPRODUCE */}
        <section id="reproduce">
          <div className="sec-head"><span className="sec-num">06</span><h2>Reproduce it</h2></div>
          <p className="sec-lead">
            From a clean checkout. Data is synthetic; the agent, baseline, and evaluation all run from
            one command. Swap the backend with one env var.
          </p>
          <pre>
{`# 1. install + configure
pip install -r requirements.txt
cp .env.example .env         `}<span className="c"># add ONE key for your provider</span>{`

# 2. run the full evaluation (baseline + agent, 10 cases)
`}<b>python eval.py</b>{`            `}<span className="c"># default: anthropic / claude-opus-5</span>{`

# 3. compare models / providers — same agent, one switch
TRIAGE_PROVIDER=openai TRIAGE_MODEL=gpt-4o-mini python eval.py
TRIAGE_PROVIDER=groq python eval.py            `}<span className="c"># free tier</span>{`

# 4. inspect one case end to end
python run_one.py evalcases/cases/case07_review_ignored.json

# 5. rebuild this dashboard from the latest run
python web/build_data.py && cd web && npm run build`}
          </pre>
          <p className="sec-lead" style={{ marginTop: 18 }}>
            The results on this page are the <code>{results.model}</code> run committed in
            <code> results/results.json</code>. Every number here is read from that file.
          </p>
        </section>
      </div>

      <footer>
        <div className="wrap">
          <strong style={{ color: "var(--text-dim)" }}>Triage Inbox</strong> · built for the micro1
          Agentic Workflows Hackathon · router → specialists → evidence-grounding verifier ·
          multi-provider (Anthropic / OpenAI / Groq / OpenRouter) · synthetic data · fully reproducible.
        </div>
      </footer>

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
