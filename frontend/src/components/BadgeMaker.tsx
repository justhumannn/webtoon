"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError, fetchBadges } from "@/lib/api";
import { downloadSheets } from "@/lib/exportImage";
import { SHEET_WIDTH, computeStats, ensureFonts, loadImage, paginate, sortBadges, type DrawContext } from "@/lib/sheet";
import type { BadgeList, SheetOptions } from "@/lib/types";

import { Field, Select, Toggle } from "./controls";
import { SheetPreview } from "./SheetPreview";
import { TitlePicker } from "./TitlePicker";

const EXAMPLE_URL = "https://comic.naver.com/community/u/aaaa/badge";

const DEFAULT_OPTIONS: SheetOptions = {
  columns: 4,
  sort: "default",
  theme: "white",
  title: "",
  scale: 2,
  perPage: 0,
  format: "jpg",
  showHeader: true,
  showProfileImage: true,
  showNickname: true,
  showScore: true,
  showSubject: true,
  includeAdult: false,
};

type Status =
  { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "loaded"; message: string };

type LoadedImages = {
  /** 어떤 데이터에 대해 불러온 이미지인지 (다른 사용자를 불러오면 다시 불러온다) */
  key: string;
  images: Map<string, HTMLImageElement | null>;
  profile: HTMLImageElement | null;
};

export function BadgeMaker() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [data, setData] = useState<BadgeList | null>(null);
  const [options, setOptions] = useState<SheetOptions>(DEFAULT_OPTIONS);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState<LoadedImages | null>(null);
  const [imageProgress, setImageProgress] = useState({ done: 0, total: 0 });
  const [downloading, setDownloading] = useState(false);

  const set = <K extends keyof SheetOptions>(key: K, value: SheetOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  async function load(target: string, includeAdult: boolean) {
    if (!target.trim()) {
      setStatus({ kind: "error", message: "배지 페이지 링크를 입력해 주세요." });
      return;
    }
    setStatus({ kind: "loading" });
    try {
      const result = await fetchBadges(target.trim(), includeAdult);
      setData(result);
      setExcluded(new Set());
      const hidden = result.hiddenAdultCount > 0 ? ` (성인 작품 ${result.hiddenAdultCount}개 제외)` : "";
      setStatus({
        kind: "loaded",
        message: `${result.profile.nickname} 님의 찐팬 배지 ${result.badges.length}개를 불러왔습니다.${hidden}`,
      });
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof ApiError ? e.message : "알 수 없는 오류가 발생했어요." });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void load(url, options.includeAdult);
  }

  // 썸네일과 폰트를 모두 불러온 뒤에 그린다 (덜 불러온 상태로 저장되는 것을 막음)
  const dataKey = data ? `${data.profile.handle}:${data.fetchedAt}:${data.badges.length}` : "";
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const paths = data.badges.map((b) => b.imageUrl).filter((p): p is string => !!p);
    let done = 0;
    const track = <T,>(p: Promise<T>) =>
      p.then((v) => {
        done += 1;
        if (!cancelled) setImageProgress({ done, total: paths.length });
        return v;
      });
    (async () => {
      const [, profile, ...imgs] = await Promise.all([
        ensureFonts(),
        loadImage(data.profile.profileImageUrl),
        ...paths.map((p) => track(loadImage(p))),
      ]);
      if (cancelled) return;
      const images = new Map<string, HTMLImageElement | null>();
      paths.forEach((p, i) => images.set(p, imgs[i] as HTMLImageElement | null));
      setLoaded({ key: dataKey, images, profile: profile as HTMLImageElement | null });
    })();
    return () => {
      cancelled = true;
    };
  }, [data, dataKey]);

  const visibleBadges = useMemo(() => {
    if (!data) return [];
    return sortBadges(
      data.badges.filter((b) => !excluded.has(b.titleId)),
      options.sort,
    );
  }, [data, excluded, options.sort]);

  const pages = useMemo(() => paginate(visibleBadges, options), [visibleBadges, options]);

  const ready = !!data && loaded?.key === dataKey;
  const dc = useMemo<DrawContext | null>(() => {
    if (!data || !loaded || loaded.key !== dataKey) return null;
    return {
      data,
      options,
      stats: computeStats(visibleBadges),
      pageCount: pages.length,
      images: loaded.images,
      profileImage: loaded.profile,
    };
  }, [data, dataKey, loaded, options, visibleBadges, pages.length]);

  async function onDownload() {
    if (!dc || !data) return;
    setDownloading(true);
    try {
      const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      await downloadSheets(pages, dc, options.scale, options.format, `webtoon-fanbadge-${data.profile.handle}-${date}`);
    } catch (e) {
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "저장하지 못했어요." });
    } finally {
      setDownloading(false);
    }
  }

  const sizeText = (() => {
    if (!data) return "링크를 불러오면 이미지 크기가 표시됩니다.";
    const w = (SHEET_WIDTH * options.scale).toLocaleString("ko-KR");
    if (pages.length === 1) {
      const h = (pages[0].height * options.scale).toLocaleString("ko-KR");
      return `${w} × ${h} px · 웹툰 ${visibleBadges.length}개`;
    }
    return `${w} px 너비 · ${pages.length}장 · 웹툰 ${visibleBadges.length}개`;
  })();

  const columnsFill = ((options.columns - 2) / (8 - 2)) * 100;
  const busy = status.kind === "loading";

  return (
    <div className="flex flex-col">
      {/* 링크 입력 */}
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label htmlFor="badge-url" className="text-[14px] font-bold">
          배지 목록 링크
        </label>
        <div className="flex gap-2">
          <input
            id="badge-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={EXAMPLE_URL}
            className="h-[44px] min-w-0 flex-1 rounded-lg border border-line px-4 text-[15px] outline-none transition placeholder:text-[#b4b7bd] focus:border-[#111]"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-[44px] shrink-0 rounded-lg bg-[#111] px-5 text-[15px] font-bold text-white transition hover:bg-[#333] disabled:opacity-60"
          >
            {busy ? "불러오는 중" : "불러오기"}
          </button>
        </div>
        <p className="text-[12px] text-muted">
          네이버웹툰 → 내 프로필 → 배지 페이지 주소를 그대로 넣으세요.{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              setUrl(EXAMPLE_URL);
              void load(EXAMPLE_URL, options.includeAdult);
            }}
          >
            예시로 불러오기
          </button>
        </p>
        {status.kind !== "idle" && (
          <div
            role="status"
            className={`mt-2 rounded-lg px-4 py-3 text-[13px] ${
              status.kind === "error" ? "bg-[#fdecec] text-[#c0392b]" : "bg-soft text-[#4a4d52]"
            }`}
          >
            {status.kind === "loading" && "네이버웹툰에서 배지 목록을 불러오는 중이에요…"}
            {status.kind === "error" && status.message}
            {status.kind === "loaded" &&
              (ready
                ? status.message
                : `${status.message} 썸네일 불러오는 중 ${imageProgress.done} / ${imageProgress.total}`)}
          </div>
        )}
      </form>

      {/* 배지 목록과 썸네일을 모두 불러온 뒤에만 옵션·다운로드·미리보기를 보여준다 */}
      {ready && (
        <div className="reveal flex flex-col">
          <hr className="my-7 border-line" />

          {/* 옵션 */}
          <div className="grid grid-cols-1 gap-x-9 gap-y-6 sm:grid-cols-2 md:grid-cols-3">
            <Field
              htmlFor="columns"
              label={
                <>
                  가로 개수 <b className="text-foreground">{options.columns}</b>
                </>
              }
            >
              <div className="flex h-[44px] items-center">
                <input
                  id="columns"
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={options.columns}
                  onChange={(e) => set("columns", Number(e.target.value))}
                  className="range"
                  style={{ ["--fill" as string]: `${columnsFill}%` }}
                />
              </div>
            </Field>
            <Select
              label="정렬"
              value={options.sort}
              onChange={(v) => set("sort", v)}
              options={[
                { value: "default", label: "기본 · 네이버 순서" },
                { value: "scoreDesc", label: "찐팬 점수 · 높은순" },
                { value: "scoreAsc", label: "찐팬 점수 · 낮은순" },
                { value: "name", label: "작품명 · 가나다순" },
              ]}
            />
            <Select
              label="테마"
              value={options.theme}
              onChange={(v) => set("theme", v)}
              options={[
                { value: "white", label: "화이트" },
                { value: "dark", label: "다크" },
              ]}
            />
            <Field label="제목 (비우면 자동)" htmlFor="title">
              <input
                id="title"
                type="text"
                value={options.title}
                maxLength={40}
                onChange={(e) => set("title", e.target.value)}
                placeholder="자동: 닉네임"
                className="h-[44px] w-full rounded-lg border border-line px-4 text-[15px] outline-none transition placeholder:text-[#b4b7bd] focus:border-[#111]"
              />
            </Field>
            <Select
              label="저장 해상도"
              value={options.scale}
              onChange={(v) => set("scale", v)}
              options={[
                { value: 1, label: "1배 (가벼움)" },
                { value: 2, label: "2배 (선명함)" },
                { value: 3, label: "3배 (아주 선명함)" },
              ]}
            />
            <Select
              label="한 장에 담을 웹툰 수"
              value={options.perPage}
              onChange={(v) => set("perPage", v)}
              options={[
                { value: 0, label: "자동 (최대한 많이)" },
                { value: 12, label: "12개" },
                { value: 24, label: "24개" },
                { value: 48, label: "48개" },
                { value: 96, label: "96개" },
              ]}
            />
            <Select
              label="파일 형식"
              value={options.format}
              onChange={(v) => set("format", v)}
              options={[
                { value: "jpg", label: "JPG · 공유하기 좋은 용량" },
                { value: "png", label: "PNG · 손실 없는 화질" },
                { value: "webp", label: "WebP · 가장 작은 용량" },
              ]}
            />
          </div>

          <hr className="my-7 border-line" />

          {/* 보이기 / 숨기기 */}
          <div className="grid grid-cols-1 gap-x-9 gap-y-3 sm:grid-cols-2">
            <Toggle label="상단 영역" checked={options.showHeader} onChange={(v) => set("showHeader", v)} />
            <Toggle label="찐팬 점수" checked={options.showScore} onChange={(v) => set("showScore", v)} />
            <Toggle
              label="프로필 사진"
              checked={options.showProfileImage}
              onChange={(v) => set("showProfileImage", v)}
            />
            <Toggle label="작품명" checked={options.showSubject} onChange={(v) => set("showSubject", v)} />
            <Toggle label="닉네임" checked={options.showNickname} onChange={(v) => set("showNickname", v)} />
            <Toggle
              label="성인 작품"
              onText="포함"
              offText="제외"
              checked={options.includeAdult}
              onChange={(v) => {
                set("includeAdult", v);
                if (data) void load(data.profile.pageUrl, v);
              }}
            />
          </div>

          <hr className="my-7 border-line" />

          {data && <TitlePicker badges={data.badges} excluded={excluded} onChange={setExcluded} />}

          {/* 다운로드 */}
          <button
            type="button"
            onClick={onDownload}
            disabled={!dc || downloading || visibleBadges.length === 0}
            className="mt-8 flex h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-[#111] text-[16px] font-bold text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {downloading ? "만드는 중…" : "다운로드"}
          </button>
          <p className="mt-3 text-center text-[13px] text-muted">{sizeText}</p>
          <p className="mt-2 text-center text-[12px] text-[#a3a6ac]">
            웹툰이 많으면 여러 장으로 나뉘며, zip 하나로 묶어 한 번에 받아집니다. 상단 정보는 첫 장에만 들어갑니다.
          </p>

          {/* 미리보기 */}
          {dc && visibleBadges.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-[14px] font-bold">미리보기</h2>
              <SheetPreview pages={pages} dc={dc} />
            </section>
          )}
        </div>
      )}

      <aside className="mt-12 rounded-lg bg-soft px-4 py-4 text-[12px] leading-relaxed text-[#6b6f76]">
        <p className="mb-1 font-semibold text-[#4a4d52]">안내</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>이 서비스는 네이버웹툰과 관련 없는 비영리 팬 제작 도구예요.</li>
          <li>웹툰 썸네일의 저작권은 각 작품의 저작권자에게 있어요. 만든 이미지는 개인적인 용도로만 사용해 주세요.</li>
          <li>배지 정보는 요청할 때만 네이버웹툰에서 가져오며, 썸네일은 서버에 저장하지 않아요.</li>
          <li>본인 배지를 확인하는 용도로 사용해 주세요. 공개하지 않은 배지는 불러올 수 없어요.</li>
        </ul>
      </aside>
    </div>
  );
}
