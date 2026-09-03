/**
 * Builds public/test-kit/label-check-test-kit.zip: six label pictures plus a
 * filled-in applications.csv, so a visitor can try the batch import with
 * nothing of their own.
 *
 * Source pictures are read from test_images/ (not committed; they are large
 * generated PNGs). Each is shrunk to a JPEG at 1600px on the long edge, which
 * is still bigger than the app sends to the model. The same JPEGs are also
 * written to public/samples so the in-app sample drop-down and the kit stay
 * identical (the application values for them live in lib/samples.ts).
 *
 *   node scripts/make-test-kit.mjs [source-dir]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.resolve(process.argv[2] ?? path.join(ROOT, "test_images"));
const OUT_DIR = path.join(ROOT, "public", "test-kit");
const SAMPLES_DIR = path.join(ROOT, "public", "samples");
const ZIP_NAME = "label-check-test-kit.zip";

// Filenames in the kit -> source picture. The CSV below refers to these names.
const PICTURES = {
  "riverstone-bourbon-label.jpg": "testlabel01.png",
  "crescent-harbor-gin-label.jpg": "testlabel02.png",
  "blue-orchard-pinot-noir-label.jpg": "testlabel03.png",
  "crescent-harbor-gin-bottle.jpg": "testphoto01.png",
  "pine-coast-harbor-haze-can.jpg": "testphoto02.png",
  "blue-orchard-pinot-noir-bottle.jpg": "testphoto03.png",
};

// One row per picture. Two rows match, two have a small discrepancy and two
// are plainly wrong, so every verdict shows up. The `note` column explains
// each; the app ignores it.
const ROWS = [
  {
    filename: "riverstone-bourbon-label.jpg",
    beverage_type: "Distilled spirits",
    brand_name: "Riverstone Distilling Co.",
    class_type: "Bourbon Whiskey",
    alcohol_content: "45% Alc./Vol.",
    net_contents: "750 mL",
    bottler_name_address: "Riverstone Distilling Co., Louisville, Kentucky",
    country_of_origin: "",
    note: "Everything matches the label.",
  },
  {
    filename: "crescent-harbor-gin-label.jpg",
    beverage_type: "Distilled spirits",
    brand_name: "Crescent Harbor Distilling Co.",
    class_type: "Gin",
    alcohol_content: "42% Alc./Vol. (84 Proof)",
    net_contents: "750 mL",
    bottler_name_address: "Crescent Harbor Distilling Co., Portland, Maine",
    country_of_origin: "United States",
    note: "Minor: application says Gin, label says Dry Gin.",
  },
  {
    filename: "blue-orchard-pinot-noir-label.jpg",
    beverage_type: "Wine",
    brand_name: "Blue Orchard Cellars",
    class_type: "Reserve Pinot Noir",
    alcohol_content: "13.5% Alc./Vol.",
    net_contents: "750 mL",
    bottler_name_address: "Blue Orchard Cellars, Napa, California",
    country_of_origin: "",
    note: "Everything matches the label.",
  },
  {
    filename: "crescent-harbor-gin-bottle.jpg",
    beverage_type: "Distilled spirits",
    brand_name: "Crescent Harbor Distilling Co.",
    class_type: "Dry Gin",
    alcohol_content: "42% Alc./Vol.",
    net_contents: "1 L",
    bottler_name_address: "Crescent Harbor Distilling Co., Portland, Maine",
    country_of_origin: "",
    note: "Major: application says 1 L, bottle says 750 mL.",
  },
  {
    filename: "pine-coast-harbor-haze-can.jpg",
    beverage_type: "Malt beverage",
    brand_name: "Pine Coast Brewing Co.",
    class_type: "Hazy India Pale Ale",
    alcohol_content: "6.5% Alc./Vol.",
    net_contents: "12 fl oz",
    bottler_name_address: "Pine Coast Brewing Co., Portland, Maine",
    country_of_origin: "",
    note: "Minor: the can prints the beer name under the brewery name, so the tool asks you to confirm the brand. 12 fl oz is accepted as the 355 mL on the can.",
  },
  {
    filename: "blue-orchard-pinot-noir-bottle.jpg",
    beverage_type: "Wine",
    brand_name: "Blue Orchard Cellars",
    class_type: "Reserve Pinot Noir",
    alcohol_content: "14.5% Alc./Vol.",
    net_contents: "750 mL",
    bottler_name_address: "Blue Orchard Cellars, Napa, California",
    country_of_origin: "",
    note: "Major: application says 14.5%, bottle says 13.5%.",
  },
];

const COLUMNS = Object.keys(ROWS[0]);

function csvCell(v) {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const csv = [COLUMNS, ...ROWS.map((r) => COLUMNS.map((c) => r[c]))]
  .map((r) => r.map(csvCell).join(","))
  .join("\r\n");

const stage = fs.mkdtempSync(path.join(os.tmpdir(), "label-check-kit-"));
const kit = path.join(stage, "label-check-test-kit");
fs.mkdirSync(kit);

for (const [name, src] of Object.entries(PICTURES)) {
  const file = path.join(SOURCE, src);
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  const jpeg = await sharp(file)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  fs.writeFileSync(path.join(kit, name), jpeg);
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  fs.writeFileSync(path.join(SAMPLES_DIR, name), jpeg);
  console.log(`  ${src} -> ${name}`);
}
fs.writeFileSync(path.join(kit, "applications.csv"), csv);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "applications.csv"), csv);
const zip = path.join(OUT_DIR, ZIP_NAME);
fs.rmSync(zip, { force: true });
execFileSync("zip", ["-r", "-X", zip, "label-check-test-kit"], { cwd: stage, stdio: "inherit" });
fs.rmSync(stage, { recursive: true, force: true });
console.log(`Wrote ${path.relative(ROOT, zip)} (${(fs.statSync(zip).size / 1024 / 1024).toFixed(1)} MB)`);
