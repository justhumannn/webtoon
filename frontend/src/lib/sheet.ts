import { apiUrl } from "./api";
import type { Badge, BadgeList, SheetOptions, SortKey, Theme } from "./types";

/**
 * 결과 이미지를 canvas 2D API 로 직접 그린다.
 * 미리보기와 다운로드가 같은 함수를 쓰므로 화면에서 본 그대로 저장된다.
 * 단위는 CSS px 이고, 저장할 때 scale(1~3배)을 곱한다.
 */

export const SHEET_WIDTH = 1000;
const PAD_X = 36;
const PAD_TOP = 40;
const GAP = 10;
const FOOTER_HEIGHT = 56;
const THUMB_RATIO = 202 / 220; // 네이버 썸네일 원본 비율 (세로/가로)
/** 모든 브라우저(특히 iOS Safari)에서 안전한 canvas 크기 */
const MAX_CANVAS_AREA = 16_000_000;
const MAX_CANVAS_SIDE = 16_000;

const FONT = `"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;

type Palette = {
  bg: string;
  text: string;
  sub: string;
  line: string;
  accent: string;
  placeholder: string;
};

const PALETTES: Record<Theme, Palette> = {
  white: {
    bg: "#ffffff",
    text: "#111111",
    sub: "#8b8f96",
    line: "#e6e7ea",
    accent: "#00a83a",
    placeholder: "#eceef1",
  },
  dark: {
    bg: "#141517",
    text: "#f3f4f6",
    sub: "#8e9298",
    line: "#2b2d31",
    accent: "#2fdc6a",
    placeholder: "#24262a",
  },
};

export type SheetPage = {
  index: number;
  badges: Badge[];
  width: number;
  height: number;
};

export type SheetStats = {
  count: number;
  average: number;
  max: number;
  min: number;
  perfect: number;
};

// ---------- 데이터 준비 ----------

export function sortBadges(badges: Badge[], sort: SortKey): Badge[] {
  const list = [...badges];
  switch (sort) {
    case "scoreDesc":
      return list.sort((a, b) => b.score - a.score);
    case "scoreAsc":
      return list.sort((a, b) => a.score - b.score);
    case "name":
      return list.sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
    default:
      return list;
  }
}

export function computeStats(badges: Badge[]): SheetStats {
  if (badges.length === 0) return { count: 0, average: 0, max: 0, min: 0, perfect: 0 };
  const scores = badges.map((b) => b.score);
  return {
    count: badges.length,
    average: scores.reduce((a, b) => a + b, 0) / scores.length,
    max: Math.max(...scores),
    min: Math.min(...scores),
    perfect: scores.filter((s) => s >= 99.9).length,
  };
}

// ---------- 레이아웃 계산 ----------

function cardMetrics(columns: number, options: SheetOptions) {
  const cardWidth = (SHEET_WIDTH - PAD_X * 2 - GAP * (columns - 1)) / columns;
  const imageHeight = cardWidth * THUMB_RATIO;
  const stripHeight = options.showScore ? clamp(cardWidth * 0.12, 20, 30) : 0;
  return { cardWidth, imageHeight, stripHeight, cardHeight: imageHeight + stripHeight };
}

function headerHeight(options: SheetOptions): number {
  // 날짜 줄 + 제목 + 통계 4칸 + 구분선
  const top = options.showHeader ? 18 + 52 + 22 + 58 + 22 : 0;
  // "FAN BADGE" 구역 제목 줄
  return PAD_TOP + top + 40;
}

const CONTINUATION_TOP = 32;

/** 한 장에 담을 작품 수에 맞춰 여러 장으로 나눈다. 상단 영역은 첫 장에만 들어간다. */
export function paginate(badges: Badge[], options: SheetOptions): SheetPage[] {
  const columns = clamp(options.columns, 2, 8);
  const { cardHeight } = cardMetrics(columns, options);
  const maxHeight = Math.floor(
    Math.min(MAX_CANVAS_SIDE / options.scale, MAX_CANVAS_AREA / (SHEET_WIDTH * options.scale * options.scale)),
  );

  const rowsThatFit = (top: number) =>
    Math.max(1, Math.floor((maxHeight - top - FOOTER_HEIGHT + GAP) / (cardHeight + GAP)));

  const pages: SheetPage[] = [];
  let rest = badges;
  while (rest.length > 0 || pages.length === 0) {
    const first = pages.length === 0;
    const top = first ? headerHeight(options) : CONTINUATION_TOP;
    let capacity = rowsThatFit(top) * columns;
    if (options.perPage > 0) capacity = Math.min(capacity, options.perPage);
    const items = rest.slice(0, capacity);
    rest = rest.slice(capacity);
    const rows = Math.max(1, Math.ceil(items.length / columns));
    const height = Math.ceil(top + rows * cardHeight + (rows - 1) * GAP + FOOTER_HEIGHT);
    pages.push({ index: pages.length, badges: items, width: SHEET_WIDTH, height });
    if (items.length === 0) break;
  }
  return pages;
}

// ---------- 이미지 불러오기 ----------

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImage(path: string | null): Promise<HTMLImageElement | null> {
  if (!path) return Promise.resolve(null);
  const src = path.startsWith("/") ? apiUrl(path) : path;
  let cached = imageCache.get(src);
  if (!cached) {
    cached = new Promise((resolve) => {
      const img = new Image();
      // 다른 도메인의 백엔드를 쓸 때도 canvas 가 오염되지 않도록 CORS 로 요청
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    imageCache.set(src, cached);
  }
  return cached;
}

export async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    ["400", "600", "700", "800"].map((w) => document.fonts.load(`${w} 16px "Pretendard Variable"`, "가A1")),
  ).catch(() => undefined);
}

// ---------- 그리기 ----------

export type DrawContext = {
  data: BadgeList;
  options: SheetOptions;
  stats: SheetStats;
  pageCount: number;
  images: Map<string, HTMLImageElement | null>;
  profileImage: HTMLImageElement | null;
};

export function drawPage(canvas: HTMLCanvasElement, page: SheetPage, dc: DrawContext, scale: number) {
  canvas.width = Math.round(page.width * scale);
  canvas.height = Math.round(page.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 를 사용할 수 없어요.");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const p = PALETTES[dc.options.theme];
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, page.width, page.height);

  const columns = clamp(dc.options.columns, 2, 8);
  let y: number;
  if (page.index === 0) {
    y = drawHeader(ctx, dc, p);
  } else {
    y = CONTINUATION_TOP;
  }

  const m = cardMetrics(columns, dc.options);
  page.badges.forEach((badge, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = PAD_X + col * (m.cardWidth + GAP);
    const cy = y + row * (m.cardHeight + GAP);
    drawCard(ctx, badge, x, cy, m, dc, p);
  });

  drawFooter(ctx, page, dc, p);
}

function drawHeader(ctx: CanvasRenderingContext2D, dc: DrawContext, p: Palette): number {
  const { options, data, stats } = dc;
  let y = PAD_TOP;
  const right = SHEET_WIDTH - PAD_X;

  if (options.showHeader) {
    const date = formatDate(data.fetchedAt);
    const customTitle = options.title.trim();
    const nicknameSuffix = customTitle && options.showNickname ? ` · ${data.profile.nickname}` : "";
    setFont(ctx, 400, 12);
    ctx.fillStyle = p.sub;
    ctx.textBaseline = "top";
    ctx.fillText(`${date} 기준 · 네이버웹툰 찐팬 배지${nicknameSuffix}`, PAD_X, y);
    y += 18;

    // 제목 줄 (프로필 사진 + 제목)
    let titleX = PAD_X;
    const avatar = 44;
    if (options.showProfileImage) {
      drawAvatar(ctx, dc, PAD_X, y + 4, avatar, p);
      titleX += avatar + 14;
    }
    const title =
      customTitle || (options.showNickname ? `${data.profile.nickname}님의 찐팬 배지` : "찐팬 배지 목록");
    setFont(ctx, 800, 30);
    ctx.fillStyle = p.text;
    ctx.textBaseline = "middle";
    ctx.fillText(ellipsize(ctx, title, right - titleX), titleX, y + 4 + avatar / 2);
    y += 52 + 22;

    // 통계 4칸
    const cells: { label: string; value: string; unit: string; accent?: boolean }[] = [
      { label: "찐팬 배지", value: stats.count.toLocaleString("ko-KR"), unit: "개" },
      { label: "평균 점수", value: stats.average.toFixed(1), unit: "점" },
      { label: "최고 점수", value: stats.max.toFixed(1), unit: "점" },
      { label: "99.9점 배지", value: stats.perfect.toLocaleString("ko-KR"), unit: "개", accent: true },
    ];
    const cellWidth = (SHEET_WIDTH - PAD_X * 2) / cells.length;
    cells.forEach((cell, i) => {
      const cx = PAD_X + i * cellWidth + (i === 0 ? 0 : 18);
      if (i > 0) {
        ctx.fillStyle = p.line;
        ctx.fillRect(PAD_X + i * cellWidth, y + 2, 1, 50);
      }
      setFont(ctx, 400, 12);
      ctx.fillStyle = p.sub;
      ctx.textBaseline = "top";
      ctx.fillText(cell.label, cx, y);
      setFont(ctx, 800, 26);
      ctx.fillStyle = cell.accent ? p.accent : p.text;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(cell.value, cx, y + 48);
      const vw = ctx.measureText(cell.value).width;
      setFont(ctx, 500, 13);
      ctx.fillStyle = p.sub;
      ctx.fillText(cell.unit, cx + vw + 4, y + 48);
    });
    y += 58 + 14;
    ctx.fillStyle = p.line;
    ctx.fillRect(PAD_X, y, SHEET_WIDTH - PAD_X * 2, 1);
    y += 8;
  }

  // 구역 제목
  setFont(ctx, 800, 17);
  ctx.fillStyle = p.text;
  ctx.textBaseline = "middle";
  ctx.fillText("FAN BADGE", PAD_X, y + 16);
  const range = stats.count > 0 ? ` [${stats.min.toFixed(1)} ~ ${stats.max.toFixed(1)}점]` : "";
  setFont(ctx, 400, 12);
  ctx.fillStyle = p.sub;
  ctx.textAlign = "right";
  ctx.fillText(`${stats.count.toLocaleString("ko-KR")}개${range}`, right, y + 16);
  ctx.textAlign = "left";
  return y + 40;
}

function drawAvatar(ctx: CanvasRenderingContext2D, dc: DrawContext, x: number, y: number, size: number, p: Palette) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (dc.profileImage) {
    drawCover(ctx, dc.profileImage, x, y, size, size);
  } else {
    ctx.fillStyle = p.accent;
    ctx.fillRect(x, y, size, size);
    setFont(ctx, 800, size * 0.42);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Array.from(dc.data.profile.nickname || "?")[0], x + size / 2, y + size / 2 + 1);
    ctx.textAlign = "left";
  }
  ctx.restore();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  badge: Badge,
  x: number,
  y: number,
  m: ReturnType<typeof cardMetrics>,
  dc: DrawContext,
  p: Palette,
) {
  const { cardWidth: w, imageHeight: ih, stripHeight: sh, cardHeight: h } = m;
  const radius = 6;
  const pad = clamp(w * 0.05, 7, 12);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();

  // 썸네일 (원본 비율 유지, 잘라내거나 늘리지 않음)
  const img = badge.imageUrl ? dc.images.get(badge.imageUrl) : null;
  ctx.fillStyle = p.placeholder;
  ctx.fillRect(x, y, w, ih);
  if (img) {
    drawCover(ctx, img, x, y, w, ih);
  }

  // 아래쪽 그라데이션 + 작품명
  if (dc.options.showSubject || !img) {
    const g = ctx.createLinearGradient(0, y + ih * 0.45, 0, y + ih);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y + ih * 0.45, w, ih * 0.55);

    const fs = clamp(w * 0.062, 10, 15);
    setFont(ctx, 700, fs);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "alphabetic";
    const maxText = w - pad * 2;
    ctx.fillText(ellipsize(ctx, badge.subject, maxText), x + pad, y + ih - pad);
  }

  // 99.9점 배지는 오른쪽 위에 작은 표시
  if (dc.options.showScore && badge.score >= 99.9) {
    const fs = clamp(w * 0.045, 9, 11);
    setFont(ctx, 700, fs);
    const label = "MAX";
    const tw = ctx.measureText(label).width;
    const ph = fs + 8;
    const pw = tw + 12;
    const px = x + w - pad - pw;
    const py = y + pad;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, px + 6, py + ph / 2 + 0.5);
  }

  // 색 띠: 작품 고유 배경색 + 찐팬 점수
  if (sh > 0) {
    const color = badge.bannerColor ?? (dc.options.theme === "dark" ? "#3a3d42" : "#9aa0a8");
    ctx.fillStyle = color;
    ctx.fillRect(x, y + ih, w, sh);
    const fg = isLight(color) ? "rgba(17,17,17,0.85)" : "rgba(255,255,255,0.95)";
    const fs = clamp(sh * 0.42, 9, 12);
    setFont(ctx, 600, fs);
    ctx.fillStyle = fg;
    ctx.textBaseline = "middle";
    const label = `찐팬 점수 ${badge.score.toFixed(1)}`;
    ctx.fillText(label, x + pad, y + ih + sh / 2 + 0.5);

    // 점수 막대 (공간이 있을 때만)
    const labelWidth = ctx.measureText(label).width;
    const barWidth = Math.min(w * 0.3, w - pad * 3 - labelWidth);
    if (barWidth > 16) {
      const bx = x + w - pad - barWidth;
      const by = y + ih + sh / 2 - 2;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.roundRect(bx, by, barWidth, 4, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, (barWidth * clamp(badge.score, 0, 100)) / 100, 4, 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, page: SheetPage, dc: DrawContext, p: Palette) {
  const y = page.height - FOOTER_HEIGHT + 18;
  ctx.fillStyle = p.line;
  ctx.fillRect(PAD_X, y, SHEET_WIDTH - PAD_X * 2, 1);
  setFont(ctx, 400, 11);
  ctx.fillStyle = p.sub;
  ctx.textBaseline = "middle";
  const pageLabel = dc.pageCount > 1 ? ` · ${page.index + 1}/${dc.pageCount}` : "";
  ctx.fillText(`찐팬 배지 이미지 · 비영리 팬 제작${pageLabel}`, PAD_X, y + 20);
  ctx.textAlign = "right";
  ctx.fillText("comic.naver.com · 썸네일 © 각 작품 저작권자", SHEET_WIDTH - PAD_X, y + 20);
  ctx.textAlign = "left";
}

// ---------- 유틸 ----------

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.naturalWidth / img.naturalHeight;
  const tr = w / h;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (ir > tr) {
    sw = sh * tr;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = sw / tr;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(chars.slice(0, mid).join("") + "…").width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join("") + "…";
}

function isLight(hex: string): boolean {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.45;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
