import JSZip from "jszip";

import { drawPage, type DrawContext, type SheetPage } from "./sheet";
import type { FileFormat } from "./types";

const MIME: Record<FileFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function canvasToBlob(canvas: HTMLCanvasElement, format: FileFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 만들지 못했어요."))),
      MIME[format],
      format === "png" ? undefined : 0.92,
    );
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 한 장이면 이미지 파일로, 여러 장이면 zip 하나로 묶어서 내려준다. */
export async function downloadSheets(
  pages: SheetPage[],
  dc: DrawContext,
  scale: number,
  format: FileFormat,
  baseName: string,
) {
  const canvas = document.createElement("canvas");
  if (pages.length === 1) {
    drawPage(canvas, pages[0], dc, scale);
    triggerDownload(await canvasToBlob(canvas, format), `${baseName}.${format}`);
    return;
  }
  const zip = new JSZip();
  for (const page of pages) {
    drawPage(canvas, page, dc, scale);
    const blob = await canvasToBlob(canvas, format);
    zip.file(`${baseName}_${String(page.index + 1).padStart(2, "0")}.${format}`, blob);
  }
  // 캔버스 메모리를 바로 돌려준다
  canvas.width = 0;
  canvas.height = 0;
  const archive = await zip.generateAsync({ type: "blob" });
  triggerDownload(archive, `${baseName}.zip`);
}
