"use client";

import { useState } from "react";
import { BEVERAGE_TYPES, type Application } from "@/lib/types";

interface Props {
  value: Application;
  onChange: (next: Application) => void;
  disabled?: boolean;
}

interface Field {
  key: keyof Application;
  label: string;
  example: string;
}

/** The four fields on every application. Shown by default. */
const MAIN_FIELDS: Field[] = [
  { key: "brandName", label: "Brand name", example: "Old Tom Distillery" },
  { key: "classType", label: "Class / type", example: "Kentucky Straight Bourbon Whiskey" },
  { key: "alcoholContent", label: "Alcohol content", example: "45% Alc./Vol. (90 Proof)" },
  { key: "netContents", label: "Net contents", example: "750 mL" },
];

/** Less often needed, so tucked away until asked for. */
const MORE_FIELDS: Field[] = [
  { key: "bottlerNameAddress", label: "Bottler name and address", example: "Old Tom Distillery, Bardstown, Kentucky" },
  { key: "countryOfOrigin", label: "Country of origin (imports only)", example: "France" },
];

export function ApplicationForm({ value, onChange, disabled }: Props) {
  const [expanded, setExpanded] = useState(false);
  const set = (key: keyof Application, v: string) => onChange({ ...value, [key]: v });
  // Keep the extra fields visible whenever one of them holds a value,
  // for example after loading a sample.
  const showMore = expanded || MORE_FIELDS.some((f) => value[f.key]);

  const input = (f: Field) => (
    <label key={f.key} className="block">
      <span className="mb-1 block font-medium">{f.label}</span>
      <input
        className="field"
        type="text"
        value={value[f.key] ?? ""}
        placeholder={f.example}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => set(f.key, e.target.value)}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block font-medium">Beverage type</span>
        <select className="field" value={value.beverageType} disabled={disabled} onChange={(e) => set("beverageType", e.target.value)}>
          {BEVERAGE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {MAIN_FIELDS.map(input)}

      {showMore ? (
        MORE_FIELDS.map(input)
      ) : (
        <button type="button" className="text-stone-600 underline" disabled={disabled} onClick={() => setExpanded(true)}>
          Also check bottler or country of origin
        </button>
      )}
    </div>
  );
}
