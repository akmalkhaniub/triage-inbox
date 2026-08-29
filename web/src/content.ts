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
    a: "It classifies each item, pulls the exact artifacts it needs, and reports discrepancies each tied to a commit, line, or diff hunk. An independent verifier drops any claim it can't ground. Measured against a plain baseline on 10 cases, it goes from 0.00 to 0.53 F1 and cuts false alarms 71%.",
  },
  {
    n: "04 · Can another person reproduce it?",
    q: "From a clean environment",
    a: "Synthetic cases with known ground truth, one pip install, one API key, one command for the agent, baseline, and evaluation. Every score ties back to a file. Runs on four providers via one env var.",
  },
];

export const CHOICES = [
  {
    h: "Router → specialists (not one mega-prompt)",
    p: "A single prompt doing both jobs blurs each task's rules (“ignore internal commits”, “judge the code not the reply”). Separate lanes keep each specialist sharp and make new lanes drop-in.",
  },
  {
    h: "Tools that fetch on demand",
    p: "The specialist calls list_commits / get_commit / read_diff only as needed — so it reads the commit body where a breaking change actually hides, instead of guessing from a subject line.",
  },
  {
    h: "A two-layer verifier",
    p: "Deterministic grounding (the cited ref and quote must exist) catches hallucinated evidence for free; an independent soundness pass then checks the verdict follows. Only verified findings score.",
  },
  {
    h: "One agent, any provider",
    p: "The loop is provider-agnostic: Anthropic natively, plus OpenAI / Groq / OpenRouter through one adapter. The eval becomes a model-comparison harness, not a single-model demo.",
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
    evidence: "F1 0.00 · 1.4 false alarms/case",
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
    evidence: "F1 0.00 → 0.53 · false alarms −71%",
    kind: "final",
  },
];
