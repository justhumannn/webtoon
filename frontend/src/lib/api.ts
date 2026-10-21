import type { BadgeList } from "./types";

/**
 * 비워두면 같은 도메인의 /api 를 쓴다(개발: Next rewrite, 운영: Nginx).
 * 백엔드를 다른 도메인에 둘 때만 NEXT_PUBLIC_API_BASE_URL 을 지정한다.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

export async function fetchBadges(url: string, includeAdult: boolean): Promise<BadgeList> {
  const query = new URLSearchParams({ url, includeAdult: String(includeAdult) });
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/badges?${query}`), { cache: "no-store" });
  } catch {
    throw new ApiError("서버에 연결하지 못했어요. 백엔드가 켜져 있는지 확인해 주세요.", "NETWORK");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.message ?? `요청에 실패했어요 (${res.status})`, body?.code ?? "UNKNOWN");
  }
  return body as BadgeList;
}
