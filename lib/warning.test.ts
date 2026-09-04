import { describe, expect, it } from "vitest";
import { REQUIRED_TEXT, checkWarning, diffWords, words } from "./warning";
import { decideVerdict } from "./verify";
import type { Extraction } from "./types";

const gw = (overrides: Partial<Extraction["governmentWarning"]>): Extraction["governmentWarning"] => ({
  present: true,
  verbatimText: REQUIRED_TEXT,
  headingBold: true,
  legible: true,
  ...overrides,
});

describe("checkWarning", () => {
  it("passes the exact statement", () => {
    const r = checkWarning(gw({}));
    expect(r.status).toBe("ok");
    expect(r.passes).toBe(true);
    expect(r.advisories).toHaveLength(0);
  });

  it("ignores line breaks and punctuation spacing", () => {
    const text = REQUIRED_TEXT.replace("pregnancy because", "pregnancy\nbecause").replace("(2)", "( 2 )");
    expect(checkWarning(gw({ verbatimText: text })).status).toBe("ok");
  });

  it("fails when missing", () => {
    expect(checkWarning(gw({ present: false, verbatimText: null })).status).toBe("missing");
  });

  it("rejects a title-case heading", () => {
    const r = checkWarning(gw({ verbatimText: REQUIRED_TEXT.replace("GOVERNMENT WARNING:", "Government Warning:") }));
    expect(r.status).toBe("heading_not_caps");
    expect(r.passes).toBe(false);
    expect(r.note).toMatch(/not in all capital/);
  });

  it("rejects a heading without the colon", () => {
    const r = checkWarning(gw({ verbatimText: REQUIRED_TEXT.replace("GOVERNMENT WARNING:", "GOVERNMENT WARNING") }));
    expect(r.status).toBe("heading_not_caps");
    expect(r.note).toMatch(/colon/);
  });

  it("rejects reworded text and shows the diff", () => {
    const reworded = REQUIRED_TEXT.replace("should not drink", "should avoid drinking");
    const r = checkWarning(gw({ verbatimText: reworded }));
    expect(r.status).toBe("wording_differs");
    expect(r.diff.filter((t) => t.kind === "removed").map((t) => t.text)).toEqual(["not", "drink"]);
    expect(r.diff.filter((t) => t.kind === "added").map((t) => t.text)).toEqual(["avoid", "drinking"]);
  });

  it("rejects a dropped clause", () => {
    const short = REQUIRED_TEXT.replace(", and may cause health problems", "");
    const r = checkWarning(gw({ verbatimText: short }));
    expect(r.status).toBe("wording_differs");
    expect(r.note).toMatch(/5 required words missing/);
  });

  it("surfaces bold uncertainty as an advisory, not a failure", () => {
    const r = checkWarning(gw({ headingBold: false }));
    expect(r.status).toBe("ok");
    expect(r.boldStatus).toBe("not_bold");
    expect(r.advisories[0]).toMatch(/not in bold/);

    const unknown = checkWarning(gw({ headingBold: null }));
    expect(unknown.status).toBe("ok");
    expect(unknown.boldStatus).toBe("unknown");
    expect(unknown.advisories[0]).toMatch(/Could not tell/);
  });
});

describe("diffWords", () => {
  it("returns all same tokens for identical input", () => {
    const d = diffWords(words("a b c"), words("a b c"));
    expect(d.every((t) => t.kind === "same")).toBe(true);
  });
});

describe("decideVerdict", () => {
  const ok = checkWarning(gw({}));
  const field = (status: "match" | "minor_discrepancy" | "mismatch" | "not_found" | "unreadable") => ({
    field: "brandName" as const,
    label: "Brand name",
    status,
    expected: "x",
    found: "x",
    uncertain: false,
    note: "n",
  });
  const good = { readable: true, issues: [] as Extraction["imageQuality"]["issues"] };

  it("approves when everything matches", () => {
    expect(decideVerdict([field("match")], ok, good).verdict).toBe("likely_approve");
  });

  it("asks for review on a minor discrepancy", () => {
    expect(decideVerdict([field("minor_discrepancy")], ok, good).verdict).toBe("needs_review");
  });

  it("rejects on a mismatch", () => {
    expect(decideVerdict([field("mismatch")], ok, good).verdict).toBe("likely_reject");
  });

  it("asks for review when the heading may not be bold", () => {
    const notBold = checkWarning(gw({ headingBold: false }));
    const v = decideVerdict([field("match")], notBold, good);
    expect(v.verdict).toBe("needs_review");
    expect(v.reasons[0]).toMatch(/may not be bold/);
  });

  it("asks for review when the model cannot tell whether the heading is bold", () => {
    const unknown = checkWarning(gw({ headingBold: null }));
    const v = decideVerdict([field("match")], unknown, good);
    expect(v.verdict).toBe("needs_review");
    expect(v.reasons[0]).toMatch(/Could not tell/);
  });

  it("rejects on a bad warning even if fields match", () => {
    const bad = checkWarning(gw({ verbatimText: "Government Warning: whatever" }));
    const v = decideVerdict([field("match")], bad, good);
    expect(v.verdict).toBe("likely_reject");
    expect(v.reasons[0]).toMatch(/Government warning/);
  });

  it("checks only the warning when no application fields were given", () => {
    const v = decideVerdict([], ok, good);
    expect(v.verdict).toBe("likely_approve");
    expect(v.reasons.some((r) => r.includes("only the government warning"))).toBe(true);

    const bad = checkWarning(gw({ present: false, verbatimText: null }));
    expect(decideVerdict([], bad, good).verdict).toBe("likely_reject");
  });

  it("cannot verify an unreadable image", () => {
    expect(decideVerdict([field("match")], ok, { readable: false, issues: ["blur"] }).verdict).toBe("cannot_verify");
  });
});
