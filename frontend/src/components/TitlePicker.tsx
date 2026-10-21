"use client";

import type { Badge } from "@/lib/types";

export function TitlePicker({
  badges,
  excluded,
  onChange,
}: {
  badges: Badge[];
  excluded: Set<number>;
  onChange: (excluded: Set<number>) => void;
}) {
  const included = badges.length - badges.filter((b) => excluded.has(b.titleId)).length;

  const toggle = (id: number) => {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[14px] text-[#6b6f76] select-none [&::-webkit-details-marker]:hidden">
        <span className="inline-block text-[10px] transition-transform group-open:rotate-90">▶</span>
        <span className="font-semibold text-[#4a4d52]">포함할 웹툰</span>
        <span>
          {included} / {badges.length}
        </span>
      </summary>
      <div className="mt-4">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="rounded-md border border-line px-3 py-1.5 text-[13px] hover:bg-soft"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={() => onChange(new Set(badges.map((b) => b.titleId)))}
            className="rounded-md border border-line px-3 py-1.5 text-[13px] hover:bg-soft"
          >
            전체 해제
          </button>
        </div>
        <ul className="grid max-h-[320px] grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2 md:grid-cols-3">
          {badges.map((b) => (
            <li key={b.titleId}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-soft">
                <input
                  type="checkbox"
                  checked={!excluded.has(b.titleId)}
                  onChange={() => toggle(b.titleId)}
                  className="h-4 w-4 accent-[#111]"
                />
                <span className="truncate">{b.subject}</span>
                <span className="ml-auto shrink-0 text-[12px] text-muted">{b.score.toFixed(1)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
