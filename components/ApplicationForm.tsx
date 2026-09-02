"use client";

import { BEVERAGE_TYPES, type Application } from "@/lib/types";

interface Props {
  value: Application;
  onChange: (next: Application) => void;
  disabled?: boolean;
}

const TEXT_FIELDS: { key: keyof Application; label: string; hint?: string; required?: boolean }[] = [
  { key: "brandName", label: "Brand name", required: true },
  { key: "classType", label: "Class / type", hint: "e.g. Kentucky Straight Bourbon Whiskey" },
  { key: "alcoholContent", label: "Alcohol content", hint: "e.g. 45% Alc./Vol. (90 Proof)" },
  { key: "netContents", label: "Net contents", hint: "e.g. 750 mL" },
  { key: "bottlerNameAddress", label: "Bottler name and address" },
  { key: "countryOfOrigin", label: "Country of origin", hint: "Imports only. Leave blank for domestic." },
];

export function ApplicationForm({ value, onChange, disabled }: Props) {
  const set = (key: keyof Application, v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block font-medium">Beverage type</span>
        <select
          className="field"
          value={value.beverageType}
          disabled={disabled}
          onChange={(e) => set("beverageType", e.target.value)}
        >
          {BEVERAGE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {TEXT_FIELDS.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block font-medium">
            {f.label}
            {f.required ? <span className="text-red-700"> *</span> : null}
          </span>
          <input
            className="field"
            type="text"
            value={value[f.key] ?? ""}
            placeholder={f.hint}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => set(f.key, e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
