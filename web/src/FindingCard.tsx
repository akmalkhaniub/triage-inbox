export interface Finding {
  claim_id: string;
  verdict: string;
  subject: string;
  evidence: Array<{ kind: string; ref: string; quote: string }>;
  confidence: number;
  rationale: string;
  grounded?: boolean | null;
  sound?: boolean | null;
  verified: boolean | null;
  verifier_note: string;
}

function Chip({ ok, label, tip }: { ok: boolean | null | undefined; label: string; tip: string }) {
  const state = ok === true ? "pass" : ok === false ? "fail" : "skip";
  const color =
    state === "pass" ? "var(--good)" : state === "fail" ? "var(--bad)" : "var(--text-faint)";
  const glyph = state === "pass" ? "✓" : state === "fail" ? "✗" : "–";
  return (
    <span
      title={tip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10.5,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 999,
        border: `1px solid ${color}`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {glyph} {label}
    </span>
  );
}

/**
 * One finding, with the verifier's TWO-LAYER decision made explicit:
 *   Layer 1 Grounding  — do the cited refs resolve and the quotes exist? (deterministic)
 *   Layer 2 Soundness  — does the verdict follow from the full artifact? (independent LLM)
 * A finding is surfaced to the maintainer only if BOTH pass. `showChips=false`
 * renders the plain baseline card (no verifier ran).
 */
export default function FindingCard({
  f,
  showChips = true,
  suppressed = false,
}: {
  f: Finding;
  showChips?: boolean;
  suppressed?: boolean;
}) {
  return (
    <div
      className="finding-card"
      style={suppressed ? { opacity: 0.72, borderStyle: "dashed" } : undefined}
    >
      <div className="fc-head" style={{ flexWrap: "wrap", gap: 6 }}>
        <span className={`vlabel ${f.verdict}`}>{f.verdict}</span>
        <strong style={{ fontSize: 13, textDecoration: suppressed ? "line-through" : "none" }}>
          {f.subject}
        </strong>
        {showChips ? (
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 5 }}>
            <Chip ok={f.grounded} label="Grounded" tip="Layer 1: cited refs resolve and quotes exist in the artifact." />
            <Chip ok={f.sound} label="Sound" tip="Layer 2: an independent model confirms the verdict follows from the full artifact." />
          </span>
        ) : (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--warn)", fontWeight: 600 }}>
            [NO GROUNDING PROOF]
          </span>
        )}
      </div>

      {f.rationale && (
        <p style={{ margin: "4px 0", fontSize: 12, color: "var(--text-dim)" }}>{f.rationale}</p>
      )}

      {showChips &&
        f.evidence &&
        f.evidence.map((ev, i) => (
          <div className="fc-quote" key={i}>
            <strong>
              Ref: {ev.kind}:{ev.ref}
            </strong>{" "}
            — "{ev.quote}"
          </div>
        ))}

      {showChips && f.verifier_note && (
        <div
          style={{
            fontSize: 11,
            color: suppressed ? "var(--bad)" : "var(--text-faint)",
            marginTop: 6,
            padding: suppressed ? "5px 8px" : 0,
            background: suppressed ? "var(--bad-bg)" : "transparent",
            borderRadius: 6,
          }}
        >
          <em>{suppressed ? "Why suppressed:" : "Verifier note:"}</em> {f.verifier_note}
        </div>
      )}
    </div>
  );
}
