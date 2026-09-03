import type { DiffToken, FieldStatus, VerificationResult, Verdict } from "@/lib/types";
import { VERDICT_LABELS } from "@/lib/types";

type Tone = "good" | "warn" | "bad" | "muted";

const TONE: Record<Tone, string> = {
  good: "bg-green-100 text-green-900",
  warn: "bg-amber-100 text-amber-900",
  bad: "bg-red-100 text-red-900",
  muted: "bg-stone-200 text-stone-800",
};

const VERDICT_STYLE: Record<Verdict, string> = {
  likely_approve: "border-green-600 bg-green-50 text-green-900",
  needs_review: "border-amber-500 bg-amber-50 text-amber-900",
  likely_reject: "border-red-600 bg-red-50 text-red-900",
  cannot_verify: "border-stone-500 bg-stone-100 text-stone-800",
};

const STATUS: Record<FieldStatus, { text: string; tone: Tone }> = {
  match: { text: "Match", tone: "good" },
  minor_discrepancy: { text: "Check", tone: "warn" },
  mismatch: { text: "Mismatch", tone: "bad" },
  not_found: { text: "Not found", tone: "bad" },
  unreadable: { text: "Unreadable", tone: "muted" },
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-base font-medium ${TONE[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: FieldStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.text}</Badge>;
}

export function VerdictBanner({ result }: { result: VerificationResult }) {
  return (
    <div className={`rounded-lg border-2 p-4 ${VERDICT_STYLE[result.verdict]}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-3xl font-semibold">{VERDICT_LABELS[result.verdict]}</h2>
        <span className="text-base opacity-80">{(result.totalMs / 1000).toFixed(1)} s</span>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-lg">
        {result.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

/** The required wording with missing words struck through and extra words highlighted. */
function WordDiff({ diff }: { diff: DiffToken[] }) {
  return (
    <p className="mt-2 rounded bg-stone-50 p-3 leading-8">
      {diff.map((t, i) => (
        <span
          key={i}
          className={
            t.kind === "removed" ? "mr-1 bg-red-100 px-1 line-through" : t.kind === "added" ? "mr-1 bg-amber-100 px-1" : "mr-1"
          }
        >
          {t.text}
        </span>
      ))}
    </p>
  );
}

/**
 * One table for everything that was checked: a row per application field,
 * then the government warning as the last row.
 */
export function ResultPanel({ result }: { result: VerificationResult }) {
  const w = result.warning;
  const wordingProblem = w.diff.some((t) => t.kind !== "same");

  return (
    <div className="space-y-4">
      <VerdictBanner result={result} />

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left">
          <thead className="bg-stone-100 text-base text-stone-600">
            <tr>
              <th className="px-3 py-2">Checked</th>
              <th className="px-3 py-2">Application</th>
              <th className="px-3 py-2">On the label</th>
              <th className="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {result.fields.map((f) => (
              <tr key={f.field} className="border-t border-stone-200 align-top">
                <td className="px-3 py-2 font-medium">{f.label}</td>
                <td className="px-3 py-2">{f.expected}</td>
                <td className="px-3 py-2">{f.found ?? <span className="text-stone-500">(not found)</span>}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={f.status} />
                  <div className="mt-1 text-base text-stone-600">{f.note}</div>
                </td>
              </tr>
            ))}

            <tr className="border-t border-stone-200 align-top">
              <td className="px-3 py-2 font-medium">Government warning</td>
              <td className="px-3 py-2 text-stone-600">Required statement, word for word, heading in capitals and bold</td>
              <td className="px-3 py-2">
                {w.found ? (
                  <span className="text-sm leading-6 whitespace-pre-wrap">{w.found}</span>
                ) : (
                  <span className="text-stone-500">(not found)</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Badge tone={w.passes ? "good" : "bad"}>{w.passes ? "Correct" : "Problem"}</Badge>
                <div className="mt-1 text-base text-stone-600">{w.note}</div>
                {w.advisories.map((a) => (
                  <div key={a} className="mt-1 text-base text-amber-900">
                    {a}
                  </div>
                ))}
              </td>
            </tr>
          </tbody>
        </table>

        {!w.passes && wordingProblem ? (
          <div className="border-t border-stone-200 px-3 py-3">
            <p className="text-base text-stone-600">
              Required wording, with <span className="bg-red-100 line-through">missing</span> and <span className="bg-amber-100">extra</span>{" "}
              words marked:
            </p>
            <WordDiff diff={w.diff} />
          </div>
        ) : null}
      </div>

      {result.imageQuality.issues.length ? (
        <p className="text-base text-stone-600">Image notes: {result.imageQuality.issues.join(", ").replace(/_/g, " ")}.</p>
      ) : null}
    </div>
  );
}
