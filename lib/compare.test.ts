import { describe, expect, it } from "vitest";
import { compareAll, compareField } from "./compare";
import type { Application, Extraction } from "./types";

const app: Application = {
  beverageType: "distilled_spirits",
  brandName: "Old Tom Distillery",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerNameAddress: "Old Tom Distillery, Bardstown, Kentucky",
  countryOfOrigin: "",
};

const read = (value: string | null, confidence = 0.95) => ({ value, confidence });

describe("brand name", () => {
  it("treats a capitalisation-only difference as a match", () => {
    const r = compareField("brandName", "Stone's Throw", read("STONE'S THROW"), app, true);
    expect(r.status).toBe("match");
    expect(r.note).toMatch(/capitalisation/);
  });

  it("handles curly apostrophes", () => {
    const r = compareField("brandName", "Stone's Throw", read("STONE’S THROW"), app, true);
    expect(r.status).toBe("match");
  });

  it("flags a shortened name as a minor discrepancy", () => {
    const r = compareField("brandName", "Old Tom Distillery", read("OLD TOM"), app, true);
    expect(r.status).toBe("minor_discrepancy");
  });

  it("flags a one-character difference as minor", () => {
    const r = compareField("brandName", "Old Tom Distillery", read("OLD TOM DISTILLERV"), app, true);
    expect(r.status).toBe("minor_discrepancy");
  });

  it("rejects a different name", () => {
    const r = compareField("brandName", "Old Tom Distillery", read("RIVERBEND SPIRITS"), app, true);
    expect(r.status).toBe("mismatch");
  });

  it("reports not_found when the label has no value and the image is fine", () => {
    const r = compareField("brandName", "Old Tom Distillery", read(null, 0.9), app, true);
    expect(r.status).toBe("not_found");
  });

  it("reports unreadable when the image is bad", () => {
    const r = compareField("brandName", "Old Tom Distillery", read(null, 0.2), app, false);
    expect(r.status).toBe("unreadable");
  });
});

describe("class/type", () => {
  it("matches ignoring case", () => {
    const r = compareField("classType", "Kentucky Straight Bourbon Whiskey", read("KENTUCKY STRAIGHT BOURBON WHISKEY"), app, true);
    expect(r.status).toBe("match");
  });

  it("flags extra words as minor", () => {
    const r = compareField("classType", "Straight Bourbon Whiskey", read("Kentucky Straight Bourbon Whiskey"), app, true);
    expect(r.status).toBe("minor_discrepancy");
  });

  it("rejects a different class", () => {
    const r = compareField("classType", "Kentucky Straight Bourbon Whiskey", read("London Dry Gin"), app, true);
    expect(r.status).toBe("mismatch");
  });
});

describe("alcohol content", () => {
  it("matches percent written differently", () => {
    const r = compareField("alcoholContent", "45% Alc./Vol. (90 Proof)", read("45% ALC/VOL"), app, true);
    expect(r.status).toBe("match");
  });

  it("accepts proof only on the label", () => {
    const r = compareField("alcoholContent", "45%", read("90 PROOF"), app, true);
    expect(r.status).toBe("match");
  });

  it("accepts a bare number in the application", () => {
    const r = compareField("alcoholContent", "45", read("45% alc./vol."), app, true);
    expect(r.status).toBe("minor_discrepancy");
  });

  it("rejects a different percentage", () => {
    const r = compareField("alcoholContent", "45% Alc./Vol.", read("40% ALC./VOL. (80 PROOF)"), app, true);
    expect(r.status).toBe("mismatch");
    expect(r.note).toMatch(/40%/);
  });

  it("flags inconsistent proof as minor", () => {
    const r = compareField("alcoholContent", "45%", read("45% ALC/VOL (80 PROOF)"), app, true);
    expect(r.status).toBe("minor_discrepancy");
  });
});

describe("net contents", () => {
  it("matches equivalent volumes", () => {
    expect(compareField("netContents", "750 mL", read("750ML"), app, true).status).toBe("match");
    expect(compareField("netContents", "750 mL", read("75 cl"), app, true).status).toBe("match");
    expect(compareField("netContents", "1 L", read("1000 mL"), app, true).status).toBe("match");
    expect(compareField("netContents", "12 fl oz", read("12 FL. OZ. (355 mL)"), app, true).status).toBe("match");
  });

  it("rejects a different volume", () => {
    const r = compareField("netContents", "750 mL", read("1 LITER"), app, true);
    expect(r.status).toBe("mismatch");
  });
});

describe("bottler", () => {
  it("ignores boilerplate and abbreviations", () => {
    const r = compareField(
      "bottlerNameAddress",
      "Old Tom Distillery, Bardstown, Kentucky",
      read("DISTILLED AND BOTTLED BY OLD TOM DISTILLERY, BARDSTOWN, KENTUCKY"),
      app,
      true,
    );
    expect(r.status).toBe("match");
  });

  it("rejects a different bottler", () => {
    const r = compareField("bottlerNameAddress", "Old Tom Distillery, Bardstown, Kentucky", read("Riverbend Spirits, Portland, Oregon"), app, true);
    expect(r.status).toBe("mismatch");
  });
});

describe("country of origin", () => {
  it("strips 'product of'", () => {
    expect(compareField("countryOfOrigin", "France", read("PRODUCT OF FRANCE"), app, true).status).toBe("match");
  });

  it("knows common aliases", () => {
    expect(compareField("countryOfOrigin", "United States", read("Made in USA"), app, true).status).toBe("match");
  });

  it("rejects a different country", () => {
    expect(compareField("countryOfOrigin", "France", read("Product of Italy"), app, true).status).toBe("mismatch");
  });
});

describe("compareAll", () => {
  const extraction: Extraction = {
    brandName: read("OLD TOM DISTILLERY"),
    classType: read("Kentucky Straight Bourbon Whiskey"),
    alcoholContent: read("45% ALC./VOL. (90 PROOF)"),
    netContents: read("750 mL"),
    bottlerNameAddress: read("Distilled and bottled by Old Tom Distillery, Bardstown, KY"),
    countryOfOrigin: read(null, 0.9),
    governmentWarning: { present: true, verbatimText: "", headingAllCaps: true, headingBold: true, legible: true },
    imageQuality: { readable: true, issues: [] },
  };

  it("skips application fields that were left blank", () => {
    const results = compareAll(app, extraction);
    expect(results.map((r) => r.field)).not.toContain("countryOfOrigin");
    expect(results).toHaveLength(5);
  });

  it("appends a low-confidence note", () => {
    const results = compareAll(app, { ...extraction, brandName: read("OLD TOM DISTILLERY", 0.3) });
    expect(results[0].status).toBe("match");
    expect(results[0].note).toMatch(/Low-confidence/);
  });
});
