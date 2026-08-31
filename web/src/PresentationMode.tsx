import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Teleprompter for recording the pitch in one take, with TWO modes:
 *
 *  • In-app bar (default) — a bottom overlay with the script. Good for rehearsing,
 *    but it IS on screen, so it would appear in a recording.
 *  • Pop-out presenter window ("clean recording") — opens a SEPARATE window with the
 *    script + controls. You record only the main app window (Game Bar / OBS capture
 *    a single window), so the recorded video stays clean while you read from the
 *    pop-out. The two windows sync over BroadcastChannel (same-origin).
 *
 * Either way it drives the pitch's 5 parts on a timer (~4:20 total, under 5 min).
 */

type Cue = { part: number; label: string; seconds: number; text: string };

const SCRIPT: Cue[] = [
  { part: 1, label: "The problem", seconds: 46,
    text: "A renamed CLI flag shipped as a 'minor fix.' Downstream CI broke the moment teams upgraded — the CHANGELOG said minor, the commit body said BREAKING, and nobody read the body. That's what Triage Inbox is for: an evidence-first multi-agent system for repository maintainers. Every release and every PR review is a stack of small, evidence-heavy judgments — and when a tired maintainer skims, breaking changes and unfixed bugs slip into production. Here are four incidents that happen every day." },
  { part: 2, label: "Why the naive baseline falls short", seconds: 40,
    text: "The reasonable first attempt is one prompt: dump the whole artifact into a single LLM call. On small inputs a strong model actually recalls most of the real problems — but it over-flags. It asserts discrepancies it cannot ground, with no verifiable reference, and guesses breaking-ness from a subject line. Good recall, poor precision — and it can't scale to a real repo you can't fit in one prompt." },
  { part: 3, label: "Watch the pipeline run (the demo)", seconds: 80,
    text: "So let's watch it actually run. A Router classifies the item. A specialist uses on-demand Git tools to drill into the commit body — here it calls get_commit and finds the BREAKING marker a subject-line skim would miss. Then the two-layer Verifier grounds the claim and checks soundness — Grounded, Sound — before it ever reaches a maintainer. And when the specialist over-reaches, Layer 1 drops the claim for free, so a maintainer never sees it. That suppression is the whole product. You can run this exact flow live on any public repo." },
  { part: 4, label: "Measured evidence", seconds: 52,
    text: "Across ten cases on GPT-4o, averaged over three live runs. The durable win is what the verifier guarantees: precision one-point-zero with zero false alarms — in every single run, zero variance. A maintainer who gets false alarms mutes the tool; the verifier is the line between one they trust and one they turn off. The honest trade-off: the agent is more conservative, so recall runs a bit below the baseline. Reliability is solved; recall is the axis to improve." },
  { part: 5, label: "Hot take & what's next", seconds: 42,
    text: "Two learnings. One I removed: forcing strict JSON schema made outputs well-formed but no more truthful — grounding, not formatting, buys correctness. My hot take: reliability isn't a smarter prompt, it's making the agent unable to assert what it can't point at. And this isn't a dead end — the CI already runs this pipeline on every pull request; the next step posts the verified findings straight onto the release PR. That's Triage Inbox. Thank you." },
];

const TOTAL = SCRIPT.reduce((s, c) => s + c.seconds, 0);
const CHANNEL = "triage-present";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// Self-contained HTML for the pop-out presenter window. It renders the script +
// controls and talks to the main window over BroadcastChannel — no bundler needed.
function presenterDoc(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Presenter — Triage Inbox</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0c0e14;color:#f3f4f6}
  .wrap{padding:16px 18px}
  .meta{font-size:12px;font-weight:800;letter-spacing:.05em;color:#a5b4fc;margin-bottom:6px}
  .count{font-size:12px;color:#9ca3af;font-family:monospace;margin-bottom:10px}
  .bar{height:4px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden;margin-bottom:12px}
  .bar>div{height:100%;background:#6366f1;width:0;transition:width .1s linear}
  .script{font-size:20px;line-height:1.55;font-weight:500}
  .btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  button{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px 14px;font-size:14px;font-weight:700;cursor:pointer}
  button.exit{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.5)}
  .hint{font-size:11px;color:#6b7280;margin-top:12px;line-height:1.4}
</style></head><body><div class="wrap">
  <div class="meta" id="meta">PRESENTING</div>
  <div class="count" id="count"></div>
  <div class="bar"><div id="prog"></div></div>
  <div class="script" id="script">Waiting for the main window…</div>
  <div class="btns">
    <button data-cmd="prev">⏮ Prev</button>
    <button data-cmd="toggle" id="pp">⏸ Pause</button>
    <button data-cmd="next">⏭ Next</button>
    <button class="exit" data-cmd="exit">✕ Exit</button>
  </div>
  <div class="hint">Record only the MAIN app window — this presenter window is separate and won't be captured. Read from here; the app advances on its own.</div>
</div>
<script>
  var ch = new BroadcastChannel(${JSON.stringify(CHANNEL)});
  ch.onmessage = function(e){
    var d = e.data || {}; if(d.type!=='state') return;
    document.getElementById('meta').textContent = 'PRESENTING · PART '+d.step+'/5 — '+String(d.label||'').toUpperCase();
    document.getElementById('count').textContent = (d.finished?'done':(d.playing?('advancing in '+Math.ceil(d.remain)+'s'):'paused'))+' · total ~'+d.total;
    document.getElementById('script').textContent = d.text || '';
    document.getElementById('prog').style.width = Math.round((d.partProgress||0)*100)+'%';
    document.getElementById('pp').textContent = d.finished ? '↻ Restart' : (d.playing ? '⏸ Pause' : '▶ Play');
  };
  document.querySelectorAll('button').forEach(function(b){
    b.onclick = function(){ ch.postMessage({type:'cmd', cmd:b.getAttribute('data-cmd')}); };
  });
  document.addEventListener('keydown', function(e){
    if(e.key===' '){e.preventDefault();ch.postMessage({type:'cmd',cmd:'toggle'});}
    else if(e.key==='ArrowRight')ch.postMessage({type:'cmd',cmd:'next'});
    else if(e.key==='ArrowLeft')ch.postMessage({type:'cmd',cmd:'prev'});
    else if(e.key==='Escape')ch.postMessage({type:'cmd',cmd:'exit'});
  });
  ch.postMessage({type:'ready'});
</script></body></html>`;
}

export default function PresentationMode({
  step, setStep, onExit,
}: { step: number; setStep: (n: number) => void; onExit: () => void; }) {
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [showScript, setShowScript] = useState(true);
  const [poppedOut, setPoppedOut] = useState(false);
  const chRef = useRef<BroadcastChannel | null>(null);
  const winRef = useRef<Window | null>(null);

  const cue = SCRIPT.find((c) => c.part === step) ?? SCRIPT[0];

  const goPart = useCallback((p: number) => {
    setStep(Math.min(5, Math.max(1, p)));
    setElapsed(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setStep]);

  const toggle = useCallback(() => setPlaying((p) => !p), []);

  // Master timer.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(id);
  }, [playing, step]);

  useEffect(() => {
    if (elapsed < cue.seconds) return;
    if (step < 5) goPart(step + 1);
    else setPlaying(false);
  }, [elapsed, cue.seconds, step, goPart]);

  const finished = step === 5 && elapsed >= cue.seconds;
  const partProgress = Math.min(1, elapsed / cue.seconds);
  const doneBefore = SCRIPT.filter((c) => c.part < step).reduce((s, c) => s + c.seconds, 0);
  const overall = Math.min(1, (doneBefore + elapsed) / TOTAL);

  // Broadcast state to the pop-out and accept its commands.
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    chRef.current = ch;
    ch.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === "ready") return; // state push below handles it
      if (d.type !== "cmd") return;
      if (d.cmd === "toggle") { if (finished) { goPart(1); setPlaying(true); } else toggle(); }
      else if (d.cmd === "next") goPart(step + 1);
      else if (d.cmd === "prev") goPart(step - 1);
      else if (d.cmd === "restart") { goPart(1); setPlaying(true); }
      else if (d.cmd === "exit") onExit();
    };
    return () => ch.close();
  }, [step, finished, goPart, toggle, onExit]);

  // Push state every render tick.
  useEffect(() => {
    chRef.current?.postMessage({
      type: "state", step, label: cue.label, text: cue.text,
      playing, finished, remain: Math.max(0, cue.seconds - elapsed),
      partProgress, total: fmt(TOTAL),
    });
  }, [step, cue, playing, finished, elapsed, partProgress]);

  // Detect the pop-out being closed.
  useEffect(() => {
    if (!poppedOut) return;
    const id = setInterval(() => {
      if (winRef.current && winRef.current.closed) { setPoppedOut(false); winRef.current = null; }
    }, 500);
    return () => clearInterval(id);
  }, [poppedOut]);

  const popOut = () => {
    const w = window.open("", "triage-presenter", "width=560,height=460");
    if (!w) { alert("Pop-up blocked — allow pop-ups for this site, then click 'Pop out teleprompter' again."); return; }
    w.document.write(presenterDoc());
    w.document.close();
    winRef.current = w;
    setPoppedOut(true);
  };

  // Keyboard on the main window (works in both modes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); if (finished) { goPart(1); setPlaying(true); } else toggle(); }
      else if (e.key === "ArrowRight") goPart(step + 1);
      else if (e.key === "ArrowLeft") goPart(step - 1);
      else if (e.key.toLowerCase() === "h") setShowScript((s) => !s);
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, finished, goPart, toggle, onExit]);

  const btn: React.CSSProperties = {
    background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer", fontWeight: 700,
  };

  // CLEAN-RECORDING MODE: the pop-out carries everything; the main window shows only
  // a slim, unobtrusive progress line (safe to leave in — or crop out).
  if (poppedOut) {
    return (
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999, height: 4, background: "rgba(0,0,0,0.15)" }}>
        <div style={{ width: `${overall * 100}%`, height: "100%", background: "var(--accent, #6366f1)", transition: "width 0.1s linear" }} />
      </div>
    );
  }

  // IN-APP BAR MODE (rehearsal / single screen).
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: "rgba(12,14,20,0.92)", backdropFilter: "blur(8px)",
      borderTop: "2px solid var(--accent, #6366f1)", color: "#fff",
      boxShadow: "0 -8px 30px rgba(0,0,0,0.4)",
    }}>
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
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ ...btn, background: "rgba(99,102,241,0.35)", borderColor: "var(--accent, #6366f1)" }} onClick={popOut} title="Open the script in a SEPARATE window so it isn't in your recording">
              📺 Pop out teleprompter (clean recording)
            </button>
            <button style={btn} onClick={() => goPart(step - 1)} title="Previous (←)">⏮</button>
            <button style={btn} onClick={() => { if (finished) { goPart(1); setPlaying(true); } else toggle(); }} title="Play/Pause (Space)">
              {finished ? "↻ Restart" : playing ? "⏸ Pause" : "▶ Play"}
            </button>
            <button style={btn} onClick={() => goPart(step + 1)} title="Next (→)">⏭</button>
            <button style={btn} onClick={() => setShowScript((s) => !s)} title="Hide/show script (H)">{showScript ? "🙈 Script" : "👁 Script"}</button>
            <button style={{ ...btn, background: "rgba(239,68,68,0.25)", borderColor: "rgba(239,68,68,0.5)" }} onClick={onExit} title="Exit (Esc)">✕ Exit</button>
          </div>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: showScript ? 12 : 0 }}>
          <div style={{ width: `${partProgress * 100}%`, height: "100%", background: "rgba(255,255,255,0.5)", borderRadius: 2, transition: "width 0.1s linear" }} />
        </div>
        {showScript && (
          <p style={{ margin: 0, fontSize: 19, lineHeight: 1.5, fontWeight: 500, color: "#f3f4f6", maxWidth: 980 }}>{cue.text}</p>
        )}
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 8 }}>
          Recording a clean video? Click <strong>📺 Pop out teleprompter</strong> and capture only the main window.
        </div>
      </div>
    </div>
  );
}
