import { describe, expect, it } from "vitest";
import { compareAll, compareField } from "./compare";
import type { Application, Extraction, FieldName } from "./types";

const app: Application = {
  beverageType: "distilled_spirits",
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerNameAddress: "Old Tom Distillery, Bardstown, Kentucky",
  countryOfOrigin: "",
};

/** Shorthand: a clearly read value on a readable image. */
const cmp = (field: FieldName, expected: string, found: string | null) =>
  compareField(field, expected, found, false, true);

describe("brand name", () => {
  it("treats a capitalisation-only difference as a match", () => {
    const r = cmp("brandName", "Stone's Throw", "STONE'S THROW");
    expect(r.status).toBe("match");
    expect(r.note).toMatch(/capitalisation/);
  });

  it("handles curly apostrophes", () => {
    expect(cmp("brandName", "Stone's Throw", "STONE’S THROW").status).toBe("match");
  });

  it("flags a shortened name as a minor discrepancy", () => {
    expect(cmp("brandName", "Old Tom Distillery", "OLD TOM").status).toBe("minor_discrepancy");
  });

  it("flags a one-character difference as minor", () => {
    expect(cmp("brandName", "Old Tom Distillery", "OLD TOM DISTILLERV").status).toBe("minor_discrepancy");
  });

  it("rejects a different name", () => {
    expect(cmp("brandName", "Old Tom Distillery", "RIVERBEND SPIRITS").status).toBe("mismatch");
  });

  it("reports not_found when the label has no value and the image is fine", () => {
    expect(cmp("brandName", "Old Tom Distillery", null).status).toBe("not_found");
  });

  it("reports unreadable when the image is bad", () => {
    expect(compareField("brandName", "Old Tom Distillery", null, false, false).status).toBe("unreadable");
  });

  it("reports unreadable when the model struggled with that field", () => {
    expect(compareField("brandName", "Old Tom Distillery", null, true, true).status).toBe("unreadable");
  });

  it("appends a note when a value was hard to read", () => {
    const r = compareField("brandName", "Old Tom Distillery", "OLD TOM DISTILLERY", true, true);
    expect(r.status).toBe("match");
    expect(r.note).toMatch(/Hard to read/);
  });
});

describe("class/type", () => {
  it("matches ignoring case", () => {
    expect(cmp("classType", "Kentucky Straight Bourbon Whiskey", "KENTUCKY STRAIGHT BOURBON WHISKEY").status).toBe("match");
  });

  it("flags extra words as minor", () => {
    expect(cmp("classType", "Straight Bourbon Whiskey", "Kentucky Straight Bourbon Whiskey").status).toBe("minor_discrepancy");
  });

  it("rejects a different class", () => {
    expect(cmp("classType", "Kentucky Straight Bourbon Whiskey", "London Dry Gin").status).toBe("mismatch");
  });

  it("matches when one line of a multi-line designation is the one applied for", () => {
    const r = cmp("classType", "Reserve Pinot Noir", "Reserve Pinot Noir / CALIFORNIA RED WINE");
    expect(r.status).toBe("match");
    expect(r.note).toMatch(/also prints "CALIFORNIA RED WINE"/);
  });

  it("does not match a multi-line designation whose lines are all different", () => {
    expect(cmp("classType", "Reserve Pinot Noir", "Chardonnay / CALIFORNIA WHITE WINE").status).toBe("mismatch");
  });
});

describe("alcohol content", () => {
  it("matches percent written differently", () => {
    expect(cmp("alcoholContent", "45% Alc./Vol. (90 Proof)", "45% ALC/VOL").status).toBe("match");
  });

  it("accepts proof only on the label", () => {
    expect(cmp("alcoholContent", "45%", "90 PROOF").status).toBe("match");
  });

  it("accepts a bare number in the application", () => {
    expect(cmp("alcoholContent", "45", "45% alc./vol.").status).toBe("minor_discrepancy");
  });

  it("rejects a different percentage", () => {
    const r = cmp("alcoholContent", "45% Alc./Vol.", "40% ALC./VOL. (80 PROOF)");
    expect(r.status).toBe("mismatch");
    expect(r.note).toMatch(/40%/);
  });

  it("flags inconsistent proof as minor", () => {
    expect(cmp("alcoholContent", "45%", "45% ALC/VOL (80 PROOF)").status).toBe("minor_discrepancy");
  });
});

describe("net contents", () => {
  it("matches equivalent volumes", () => {
    expect(cmp("netContents", "750 mL", "750ML").status).toBe("match");
    expect(cmp("netContents", "750 mL", "75 cl").status).toBe("match");
    expect(cmp("netContents", "1 L", "1000 mL").status).toBe("match");
    expect(cmp("netContents", "12 fl oz", "12 FL. OZ. (355 mL)").status).toBe("match");
  });

  it("rejects a different volume", () => {
    expect(cmp("netContents", "750 mL", "1 LITER").status).toBe("mismatch");
  });
});

describe("bottler", () => {
  it("ignores boilerplate and abbreviations", () => {
    const r = cmp(
      "bottlerNameAddress",
      "Old Tom Distillery, Bardstown, Kentucky",
      "DISTILLED AND BOTTLED BY OLD TOM DISTILLERY, BARDSTOWN, KENTUCKY",
    );
    expect(r.status).toBe("match");
  });

  it("rejects a different bottler", () => {
    expect(cmp("bottlerNameAddress", "Old Tom Distillery, Bardstown, Kentucky", "Riverbend Spirits, Portland, Oregon").status).toBe("mismatch");
  });
});

describe("country of origin", () => {
  it("strips 'product of'", () => {
    expect(cmp("countryOfOrigin", "France", "PRODUCT OF FRANCE").status).toBe("match");
  });

  it("knows common aliases", () => {
    expect(cmp("countryOfOrigin", "United States", "Made in USA").status).toBe("match");
  });

  it("rejects a different country", () => {
    expect(cmp("countryOfOrigin", "France", "Product of Italy").status).toBe("mismatch");
  });
});

describe("compareAll", () => {
  const extraction: Extraction = {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% ALC./VOL. (90 PROOF)",
    netContents: "750 mL",
    bottlerNameAddress: "Distilled and bottled by Old Tom Distillery, Bardstown, KY",
    countryOfOrigin: null,
    uncertain: [],
    governmentWarning: { present: true, verbatimText: "", headingBold: true, legible: true },
    imageQuality: { readable: true, issues: [] },
  };

  it("skips application fields that were left blank", () => {
    const results = compareAll(app, extraction);
    expect(results.map((r) => r.field)).not.toContain("countryOfOrigin");
    expect(results).toHaveLength(5);
  });

  it("carries the model's uncertainty through to the field", () => {
    const results = compareAll(app, { ...extraction, uncertain: ["brandName"] });
    expect(results[0].status).toBe("match");
    expect(results[0].uncertain).toBe(true);
    expect(results[0].note).toMatch(/Hard to read/);
  });

  it("compares nothing when the application is empty", () => {
    expect(compareAll({ ...app, brandName: "", classType: "", alcoholContent: "", netContents: "", bottlerNameAddress: "" }, extraction)).toHaveLength(0);
  });
});
