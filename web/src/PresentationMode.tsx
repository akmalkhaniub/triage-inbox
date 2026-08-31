import { useEffect, useState, useCallback } from "react";

/**
 * Hands-free teleprompter for recording the pitch video in one take.
 *
 * It drives the pitch's `videoStep` (1–5) on a timer matched to each part's
 * narration length, and shows a large auto-paced teleprompter bar with the
 * spoken lines and a countdown. The presenter just hits record and reads —
 * Space to pause, ←/→ to jump parts, H to hide the script, Esc to exit.
 */

type Cue = { part: number; label: string; seconds: number; text: string };

const SCRIPT: Cue[] = [
  {
    part: 1,
    label: "The problem",
    seconds: 46,
    text:
      "A renamed CLI flag shipped as a 'minor fix.' Downstream CI broke the moment teams upgraded — the CHANGELOG said minor, the commit body said BREAKING, and nobody read the body. That's what Triage Inbox is for: an evidence-first multi-agent system for repository maintainers. Every release and every PR review is a stack of small, evidence-heavy judgments — and when a tired maintainer skims, breaking changes and unfixed bugs slip into production. Here are four incidents that happen every day.",
  },
  {
    part: 2,
    label: "Why the naive baseline falls short",
    seconds: 40,
    text:
      "The reasonable first attempt is one prompt: dump the whole artifact into a single LLM call. On small inputs a strong model actually recalls most of the real problems — but it over-flags. It asserts discrepancies it cannot ground, with no verifiable reference, and guesses breaking-ness from a subject line. Good recall, poor precision — and it can't scale to a real repo you can't fit in one prompt.",
  },
  {
    part: 3,
    label: "Watch the pipeline run (the demo)",
    seconds: 80,
    text:
      "So let's watch it actually run. A Router classifies the item. A specialist uses on-demand Git tools to drill into the commit body — here it calls get_commit and finds the BREAKING marker a subject-line skim would miss. Then the two-layer Verifier grounds the claim and checks soundness — Grounded, Sound — before it ever reaches a maintainer. And when the specialist over-reaches, Layer 1 drops the claim for free, so a maintainer never sees it. That suppression is the whole product. You can run this exact flow live on any public repo.",
  },
  {
    part: 4,
    label: "Measured evidence",
    seconds: 52,
    text:
      "Across ten cases on GPT-4o, averaged over three live runs. The durable win is what the verifier guarantees: precision one-point-zero with zero false alarms — in every single run, zero variance. A maintainer who gets false alarms mutes the tool; the verifier is the line between one they trust and one they turn off. The honest trade-off: the agent is more conservative, so recall runs a bit below the baseline. Reliability is solved; recall is the axis to improve.",
  },
  {
    part: 5,
    label: "Hot take & what's next",
    seconds: 42,
    text:
      "Two learnings. One I removed: forcing strict JSON schema made outputs well-formed but no more truthful — grounding, not formatting, buys correctness. My hot take: reliability isn't a smarter prompt, it's making the agent unable to assert what it can't point at. And this isn't a dead end — the CI already runs this pipeline on every pull request; the next step posts the verified findings straight onto the release PR. That's Triage Inbox. Thank you.",
  },
];

const TOTAL = SCRIPT.reduce((s, c) => s + c.seconds, 0);

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function PresentationMode({
  step,
  setStep,
  onExit,
}: {
  step: number;
  setStep: (n: number) => void;
  onExit: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0); // seconds within current part
  const [showScript, setShowScript] = useState(true);

  const cue = SCRIPT.find((c) => c.part === step) ?? SCRIPT[0];

  const goPart = useCallback(
    (p: number) => {
      const clamped = Math.min(5, Math.max(1, p));
      setStep(clamped);
      setElapsed(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setStep]
  );

  // Tick while playing.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(id);
  }, [playing, step]);

  // Advance when the current part's time is up.
  useEffect(() => {
    if (elapsed < cue.seconds) return;
    if (step < 5) goPart(step + 1);
    else setPlaying(false); // finished
  }, [elapsed, cue.seconds, step, goPart]);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "ArrowRight") goPart(step + 1);
      else if (e.key === "ArrowLeft") goPart(step - 1);
      else if (e.key.toLowerCase() === "h") setShowScript((s) => !s);
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, goPart, onExit]);

  const partProgress = Math.min(1, elapsed / cue.seconds);
  const doneBefore = SCRIPT.filter((c) => c.part < step).reduce((s, c) => s + c.seconds, 0);
  const overall = Math.min(1, (doneBefore + elapsed) / TOTAL);
  const finished = step === 5 && elapsed >= cue.seconds;

  const btn: React.CSSProperties = {
    background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 700,
  };

  return (
    <div
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999,
        background: "rgba(12,14,20,0.92)", backdropFilter: "blur(8px)",
        borderTop: "2px solid var(--accent, #6366f1)", color: "#fff",
        boxShadow: "0 -8px 30px rgba(0,0,0,0.4)",
      }}
    >
      {/* overall progress */}
      <div style={{ height: 4, background: "rgba(255,255,255,0.12)" }}>
        <div style={{ width: `${overall * 100}%`, height: "100%", background: "var(--accent, #6366f1)", transition: "width 0.1s linear" }} />
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", color: "var(--accent, #a5b4fc)" }}>
            🎥 PRESENTING · PART {step}/5 — {cue.label.toUpperCase()}
          </span>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(255,255,255,0.6)" }}>
            {finished ? "done" : playing ? `advancing in ${Math.ceil(cue.seconds - elapsed)}s` : "paused"} · total ~{fmt(TOTAL)}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button style={btn} onClick={() => goPart(step - 1)} title="Previous (←)">⏮</button>
            <button style={btn} onClick={() => { if (finished) { goPart(1); setPlaying(true); } else setPlaying((p) => !p); }} title="Play/Pause (Space)">
              {finished ? "↻ Restart" : playing ? "⏸ Pause" : "▶ Play"}
            </button>
            <button style={btn} onClick={() => goPart(step + 1)} title="Next (→)">⏭</button>
            <button style={btn} onClick={() => setShowScript((s) => !s)} title="Hide/show script (H)">{showScript ? "🙈 Script" : "👁 Script"}</button>
            <button style={{ ...btn, background: "rgba(239,68,68,0.25)", borderColor: "rgba(239,68,68,0.5)" }} onClick={onExit} title="Exit (Esc)">✕ Exit</button>
          </div>
        </div>

        {/* per-part progress */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: showScript ? 12 : 0 }}>
          <div style={{ width: `${partProgress * 100}%`, height: "100%", background: "rgba(255,255,255,0.5)", borderRadius: 2, transition: "width 0.1s linear" }} />
        </div>

        {showScript && (
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.5, fontWeight: 500, color: "#f3f4f6", maxWidth: 980 }}>
            {cue.text}
          </p>
        )}
      </div>
    </div>
  );
}
