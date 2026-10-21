"use client";

import { useId, type ReactNode } from "react";

export function Field({ label, children, htmlFor }: { label: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label htmlFor={htmlFor} className="text-[13px] text-[#6b6f76]">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const found = options.find((o) => String(o.value) === e.target.value);
            if (found) onChange(found.value);
          }}
          className="h-[44px] w-full appearance-none rounded-lg border border-line bg-white pl-4 pr-14 text-[15px] text-foreground outline-none transition focus:border-[#111]"
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute right-4 top-1/2 h-7 w-7 -translate-y-1/2 text-[#8b8f96]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 9l7 7 7-7" />
        </svg>
      </div>
    </Field>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  onText = "보여짐",
  offText = "숨김",
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onText?: string;
  offText?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-4 py-1 text-left"
    >
      <span
        className={`relative inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#111]" : "bg-[#d5d7db]"
        }`}
      >
        <span
          className={`absolute h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[23px]" : "translate-x-[3px]"
          }`}
        />
      </span>
      <span className="text-[15px] text-[#4a4d52]">
        {label} {checked ? onText : offText}
      </span>
    </button>
  );
}
