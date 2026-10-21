"use client";

import { useEffect, useRef } from "react";

import { drawPage, type DrawContext, type SheetPage } from "@/lib/sheet";

/** 저장될 이미지와 같은 그리기 함수로 미리보기를 그린다. */
export function SheetPreview({ pages, dc }: { pages: SheetPage[]; dc: DrawContext }) {
  return (
    <div className="flex flex-col gap-4">
      {pages.map((page) => (
        <PreviewCanvas key={page.index} page={page} dc={dc} />
      ))}
    </div>
  );
}

function PreviewCanvas({ page, dc }: { page: SheetPage; dc: DrawContext }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    drawPage(ref.current, page, dc, ratio);
  }, [page, dc]);

  return (
    <canvas
      ref={ref}
      className="h-auto w-full rounded-lg border border-line"
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
      aria-label={`미리보기 ${page.index + 1}번째 장`}
    />
  );
}
