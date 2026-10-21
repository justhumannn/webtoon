export type Badge = {
  titleId: number;
  subject: string;
  imageUrl: string | null;
  sourceImageUrl: string | null;
  bannerColor: string | null;
  score: number;
  adult: boolean;
  titleUrl: string;
};

export type BadgeList = {
  profile: {
    handle: string;
    nickname: string;
    profileImageUrl: string | null;
    pageUrl: string;
  };
  totalCount: number;
  hiddenAdultCount: number;
  badges: Badge[];
  fetchedAt: string;
};

export type SortKey = "default" | "scoreDesc" | "scoreAsc" | "name";
export type Theme = "white" | "dark";
export type FileFormat = "jpg" | "png" | "webp";
/** 0 = 자동(최대한 많이) */
export type PerPage = 0 | 12 | 24 | 48 | 96;

export type SheetOptions = {
  columns: number;
  sort: SortKey;
  theme: Theme;
  title: string;
  scale: 1 | 2 | 3;
  perPage: PerPage;
  format: FileFormat;
  showHeader: boolean;
  showProfileImage: boolean;
  showNickname: boolean;
  showScore: boolean;
  showSubject: boolean;
  includeAdult: boolean;
};
