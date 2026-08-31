// Narrative content for the submission page. Kept out of App.tsx so the story
// is easy to edit. Metrics are never hard-coded here — those come from results.json.

export const QUESTIONS = [
  {
    n: "01 · Who has this problem?",
    q: "The repository maintainer",
    a: "Anyone who owns a repo's release notes and its pull-request reviews — an OSS maintainer, a release manager, a tech lead merging a teammate's work.",
  },
  {
    n: "02 · What's the bottleneck?",
    q: "Evidence spread across the repo",
    a: "A CHANGELOG can quietly drift from what shipped (a breaking change filed as a fix, a feature listed that never merged). A PR author can reply “done” without actually addressing the review. Verifying either by hand means cross-reading commits, diffs, and threads — so people skim, and mistakes slip to merge.",
  },
  {
    n: "03 · Does the agent solve it well?",
    q: "Yes — with evidence, not vibes",
    a: "It classifies each item, pulls the exact artifacts it needs, and reports discrepancies each tied to a commit, line, or diff hunk. An independent verifier drops any claim it can't ground. Measured against a plain baseline on 10 cases (fairly scored), it matches the baseline's recall (0.90) while lifting precision 0.82 → 1.00 and eliminating false alarms (0.2 → 0.0/task) on GPT-4o — F1 0.86 → 0.95.",
  },
  {
    n: "04 · Can another person reproduce it?",
    q: "From a clean environment",
    a: "Synthetic cases with known ground truth, one pip install, one API key, one command for the agent, baseline, and evaluation. Every score ties back to a file. Runs on four providers via one env var.",
  },
];

export const CHOICES = [
  {
    h: "Router ➔ Parallel Domain Specialists (not one mega-prompt)",
    p: "A single prompt doing both tasks blurs domain rules (“ignore internal chore commits”, “judge the code diff not the author reply”). Dedicated specialists execute in parallel and keep domain rules sharp.",
  },
  {
    h: "On-Demand Tools that fetch exact code slices",
    p: "Specialists call list_commits, get_commit, and get_diff concurrently as needed — reading the commit body where breaking changes hide instead of guessing from vague subject lines.",
  },
  {
    h: "Two-Layer Verification Seam (Load-Bearing in Score)",
    p: "Deterministic grounding asserts cited SHAs and quotes physically exist in code; an independent soundness pass audits logical validity. Only verified findings reach maintainers.",
  },
  {
    h: "Universal Finding Contract & Multi-Provider Engine",
    p: "The engine is provider-agnostic across OpenAI, Anthropic, Groq, and OpenRouter, outputting standardized Finding schemas for any repository lane.",
  },
];

type Story = {
  stage: string;
  body: string;
  badge?: string;
  badgeKind?: "kept" | "removed";
  evidence?: string;
  kind?: "removed" | "final";
};

export const STORY: Story[] = [
  {
    stage: "Baseline",
    body: "One general-purpose agent, one prompt, the whole artifact dumped in, no tools or verifier. A reasonable first attempt — and the bar to beat.",
    evidence: "F1 0.857 · precision 0.82 · 0.2 false alarms/case (fair scorer)",
  },
  {
    stage: "Iter 1 — router + specialists",
    body: "Split the flat prompt into a router and per-type specialists so each task's rules stay sharp. Recall rose on the type-specific hard cases.",
    badge: "kept", badgeKind: "kept",
  },
  {
    stage: "Iter 2 — on-demand tools",
    body: "Gave specialists tools to pull commits, diffs, and comments as needed, instead of dumping everything up front. Lets the agent drill into a commit body where breaking changes hide.",
    badge: "kept", badgeKind: "kept",
  },
  {
    stage: "Iter 3 — the verifier",
    body: "Added a two-layer verifier: deterministic grounding (ref + quote must exist) then an independent soundness check. Scoring counts only verified findings, so hallucinated findings can't register as false positives. The decisive lever.",
    badge: "kept", badgeKind: "kept",
  },
  {
    stage: "Iter 4 — verifier bug, found by a live smoke test",
    body: "On the first real run the verifier rejected a correct “phantom” finding: it was judging an absence claim (“no commit supports this line”) from a single quote — and you can't prove an absence from one artifact. Fix: hand the verifier the full (small) artifact. The case flipped from wrong to right.",
    badge: "kept", badgeKind: "kept",
    evidence: "case01: verified false → true",
  },
  {
    stage: "Iter 5 — drill-down heuristic, found the same way",
    body: "On the hardest case the model finalized without ever reading the commit body where BREAKING CHANGE lived. Added an explicit rule: read the body for rename/remove/change commits and for major releases. The case flipped from 0 findings to a correct one — even on a weak model.",
    badge: "kept", badgeKind: "kept",
    evidence: "case03: 0 → 1 correct",
  },
  {
    stage: "Iter 6 — multi-provider",
    body: "Made the loop provider-agnostic so the same agent runs on Anthropic, OpenAI, Groq, or OpenRouter. Turned the harness into a model-comparison tool; the whole pipeline was first validated end to end on Groq's free tier.",
    badge: "kept", badgeKind: "kept",
  },
  {
    stage: "Removed — force structured output on the generator",
    body: "Tried forcing the specialist to emit strict JSON to cut parse errors. It made the model over-cautious and hurt recall, and the verifier already neutralized bad findings downstream. Removed — the lesson: fix reliability at the verification seam, not by muzzling the generator.",
    badge: "removed", badgeKind: "removed", kind: "removed",
  },
  {
    stage: "Final",
    body: "Router + specialists + on-demand tools + two-layer verifier, verified-only scoring, any provider. Main contribution: verification at the seam is what turns a fluent generator into a reliable one.",
    evidence: "GPT-4o: F1 0.86 → 0.95 · precision 0.82 → 1.00 · 0.2 → 0.0 false alarms",
    kind: "final",
  },
];
