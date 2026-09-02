import { describe, expect, it } from "vitest";
import { normaliseHeader, parseCsv, parseCsvRecords, toCsv } from "./csv";

describe("parseCsv", () => {
  it("splits simple rows", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quotes, embedded commas and doubled quotes", () => {
    expect(parseCsv('name,addr\n"Old Tom, Inc.","12 ""Main"" St"')).toEqual([
      ["name", "addr"],
      ["Old Tom, Inc.", '12 "Main" St'],
    ]);
  });

  it("handles CRLF and a BOM", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a\n\n1\n,\n")).toEqual([["a"], ["1"]]);
  });
});

describe("parseCsvRecords", () => {
  it("keys rows by normalised header", () => {
    const recs = parseCsvRecords("File Name,Brand Name\nx.png,Old Tom");
    expect(recs).toEqual([{ file_name: "x.png", brand_name: "Old Tom" }]);
  });
});

describe("normaliseHeader", () => {
  it("snake-cases", () => {
    expect(normaliseHeader(" Class / Type ")).toBe("class_type");
  });
});

describe("toCsv", () => {
  it("round-trips through parseCsv", () => {
    const rows = [
      ["a", "b"],
      ['say "hi"', "x,y\nz"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
