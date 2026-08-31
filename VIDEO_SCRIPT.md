# 🎬 Triage Inbox — Solution Video Script (≤ 5:00)

**Target:** ~4:45 spoken at ~150 wpm. **Format:** screen recording + voiceover.
**Covers every deliverable-#03 requirement:** problem → baseline → one full live
execution → final comparison → changelog (biggest change + one removed experiment)
→ hot take.

**Honesty note baked into the script:** the headline is the *fair* comparison —
baseline F1 **0.857**, agent **0.947**; the real win is **precision 0.82 → 1.00 at
equal recall (0.90)**, i.e. the verifier removes false alarms. Do **not** claim
"baseline scored zero" — that was a retracted scoring artifact, and a judge who
opens a trajectory will catch it. The precision story is stronger *because* it
survives scrutiny.

---

## 0:00 – 0:40 · The problem & the user  *(screen: #/video step 1, or the queue tab)*

> "Meet the open-source maintainer on a Monday morning. Their triage queue is full
> of small, evidence-heavy judgment calls. Two of the nastiest:
> **one** — does the release CHANGELOG actually match what shipped, or is a breaking
> change quietly buried under 'Changed'?
> **two** — did this pull request really address its review comments, or did the
> author reply 'done 👍' and only reformat whitespace?
> Both require diffing claims against real Git artifacts, one commit at a time. It's
> tedious, so people skim — and skimming is how breaking changes reach production."

## 0:40 – 1:20 · The baseline, honestly  *(screen: Video step, split "Flat LLM" card)*

> "The reasonable first attempt is one prompt: dump the whole artifact into a single
> LLM call and ask for the discrepancies. And on small inputs a strong model is
> actually decent at this — it *recalls* most of the real problems.
> The trouble is precision. It over-flags: it asserts a discrepancy it can't point
> at — a phantom 'missing docs' entry — with total confidence and no verifiable
> reference. Measured fairly across ten cases, the baseline lands at **F1 0.86, but
> precision 0.82, with a false alarm on one task in five.** For a tired maintainer,
> false alarms are how a tool loses trust. That's the gap we set out to close —
> keep the recall, kill the false alarms."

## 1:20 – 3:00 · One full execution, start to finish  *(screen: 🐙 Live GitHub Scanner)*

*Pre-stage a run so it's fast: e.g. a real release, or case03 in the benchmark tab.
Turn Evaluation Mode to **Side-by-Side**.*

> "Here's the full system on one item, live. I search a real repo and hit run.
> **First, the Router** classifies the item — CHANGELOG audit or review resolution —
> and dispatches to the right specialist. Open its trajectory: you can see its exact
> system prompt and its decision.
> **The specialist** doesn't get a giant dump. It calls tools on demand —
> `list_commits`, then `get_commit` to read the *body*, because you cannot tell if a
> rename is breaking from the subject line alone. Watch it drill into the commit body
> and pull out the `BREAKING CHANGE` marker.
> It proposes findings, each tied to a concrete ref and an exact quote.
> **Then the verifier — this is the heart of it.** Two layers. Layer one, grounding:
> deterministic, no model cost — does every cited ref resolve, and does the quote
> actually exist in the artifact? Layer two, soundness: an independent model checks
> the verdict follows from the *whole* artifact.
> Look at the result panel. Findings that pass both get **Grounded ✓ Sound ✓** and
> are surfaced to the maintainer. But see this one under **'Suppressed by verifier'** —
> the specialist raised it, but its quote didn't ground, so it's dropped with the
> reason shown. In the flat baseline on the right, that same claim goes straight to
> the maintainer as a false alarm. *That* suppression is the whole product."

## 3:00 – 3:45 · The final comparison  *(screen: benchmark tab, Measured Benchmark card)*

> "Across all ten cases on GPT-4o, fairly scored — and you can reproduce this offline
> with `python rescore.py`, no API key needed:
> Recall is **0.90 for both** arms — the architecture doesn't magically find more.
> What changes is precision: **0.82 to 1.00.** False alarms: **0.2 per task down to
> zero.** F1: **0.86 to 0.95.** The agent surfaced nine real problems with zero false
> positives; the baseline got the same nine but cried wolf twice. On tiny fixtures
> that's the gap. On a real 500-commit release — which you simply cannot fit in one
> prompt — the on-demand tools are also what let it run at all."

## 3:45 – 4:30 · The changelog: biggest change + one we removed  *(screen: #/architecture changelog)*

> "The changelog tells the story. The change that mattered most was **iteration three,
> the verifier** — grounding removes fabricated and unsupported findings for free,
> before any expensive reasoning, and that's the entire precision jump.
> One experiment we **removed**: forcing the generator to emit a strict JSON schema,
> hoping format discipline would curb bad findings. It produced beautifully-formatted
> outputs that were still factually wrong — a clean finding citing a nonexistent
> commit is still wrong. It taught us the lever is *grounding, not formatting*, which
> is exactly what pushed us to build the verifier instead.
> And one bug the live runs caught: the verifier first rejected a *correct* absence
> claim, because it was judging 'no commit supports this line' from a single quote —
> you can't prove an absence from one artifact. We now hand it the full artifact.
> A verifier's context has to match the shape of the claim."

## 4:30 – 4:55 · Hot take, forward-look & close  *(screen: Part 5 / hero)*

> "Our hot take: for judgment-over-artifacts work, reliability isn't a smarter prompt —
> it's making the agent **unable to assert what it can't point at.** Let the generator
> be bold, and verify at the seam where claims meet evidence.
> And this isn't a demo dead-end: the CI workflow already runs this pipeline on every
> pull request — the next step is to post the verified findings straight onto the
> release PR, so the maintainer sees the breaking change and its proof inline before
> they merge. Precision is already solved; the honest next target is recall. That's
> Triage Inbox. Thanks for watching."

---

### Production checklist
- [ ] Pre-run one live audit so the on-screen run is fast (or use a cached benchmark case).
- [ ] Set **Evaluation Mode → Side-by-Side** before recording the execution.
- [ ] Have one case with a **suppressed** finding staged — it's the money shot for the precision story.
- [ ] Keep the numbers on screen matching `results/results.json` (F1 0.86 → 0.95, precision 0.82 → 1.00).
- [ ] Total runtime under 5:00; if long, trim the changelog section to just the verifier + the removed experiment.
