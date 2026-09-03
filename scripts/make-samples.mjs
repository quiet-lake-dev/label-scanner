// Renders the two made-up labels in public/samples from SVG. Run with:
//   node scripts/make-samples.mjs
// Each has a deliberate government-warning fault (a title-case heading, a
// reworded statement) that the realistic pictures do not show. The realistic
// pictures in public/samples come from scripts/make-test-kit.mjs.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("public/samples");
const W = 900;
const H = 1200;

const WARNING_BODY =
  "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy " +
  "because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

const labels = [
  {
    file: "wine.png",
    bg: "#fbf7f0",
    ink: "#3a2a2a",
    accent: "#7a1f2b",
    font: "DejaVu Serif, Georgia, serif",
    lines: [
      ["STONE'S THROW", 66, "bold"],
      ["Cabernet Sauvignon", 36, "normal"],
      ["Paso Robles", 28, "italic"],
      ["13.5% ALC. BY VOL.", 28, "normal"],
      ["750 mL", 28, "normal"],
      ["PRODUCED AND BOTTLED BY", 20, "normal"],
      ["STONE'S THROW VINEYARDS, PASO ROBLES, CALIFORNIA", 20, "normal"],
    ],
    // Title case heading: this is the rejection Jenny described.
    warningHeading: "Government Warning:",
    warningBody: WARNING_BODY,
  },
  {
    file: "gin.png",
    bg: "#eef3f1",
    ink: "#12332b",
    accent: "#2f6f5e",
    font: "DejaVu Sans, Helvetica, sans-serif",
    lines: [
      ["HARBOUR LIGHT", 64, "bold"],
      ["London Dry Gin", 38, "normal"],
      ["Distilled with juniper, coriander and citrus peel", 22, "italic"],
      ["47% ALC./VOL. (94 PROOF)", 30, "bold"],
      ["700 mL", 30, "bold"],
      ["PRODUCT OF ENGLAND", 22, "normal"],
      ["IMPORTED BY NORTHGATE IMPORTS, BALTIMORE, MARYLAND", 20, "normal"],
    ],
    warningHeading: "GOVERNMENT WARNING:",
    // Reworded: "should not drink" became "should avoid drinking".
    warningBody: WARNING_BODY.replace("should not drink", "should avoid drinking"),
  },
];

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&#39;");
}

function wrap(text, maxChars) {
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > maxChars) {
      out.push(line.trim());
      line = word;
    } else {
      line += " " + word;
    }
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

function svgFor(l) {
  let y = 170;
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="${l.bg}"/>`);
  parts.push(`<rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${l.accent}" stroke-width="6"/>`);
  parts.push(`<rect x="56" y="56" width="${W - 112}" height="${H - 112}" fill="none" stroke="${l.accent}" stroke-width="2"/>`);

  for (const [text, size, style] of l.lines) {
    const weight = style === "bold" ? "bold" : "normal";
    const fs = style === "italic" ? "italic" : "normal";
    parts.push(
      `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${l.font}" font-size="${size}" font-weight="${weight}" font-style="${fs}" fill="${l.ink}">${esc(text)}</text>`,
    );
    y += size * 1.9;
  }

  parts.push(`<line x1="120" y1="${y}" x2="${W - 120}" y2="${y}" stroke="${l.accent}" stroke-width="2"/>`);
  y += 60;

  // Warning block: heading as its own run, then the body wrapped.
  const bodySize = 21;
  const lines = wrap(`${l.warningHeading} ${l.warningBody}`, 68);
  const headingLen = l.warningHeading.length;
  lines.forEach((ln, i) => {
    let content;
    if (i === 0 && ln.startsWith(l.warningHeading)) {
      content = `<tspan font-weight="bold">${esc(ln.slice(0, headingLen))}</tspan>${esc(ln.slice(headingLen))}`;
    } else {
      content = esc(ln);
    }
    parts.push(
      `<text x="90" y="${y}" font-family="${l.font}" font-size="${bodySize}" fill="${l.ink}">${content}</text>`,
    );
    y += bodySize * 1.5;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const l of labels) {
  const png = await sharp(Buffer.from(svgFor(l))).png().toBuffer();
  fs.writeFileSync(path.join(OUT, l.file), png);
  console.log("wrote", l.file, png.length, "bytes");
}
