# 웹툰 찐팬 배지 이미지 만들기

네이버웹툰 커뮤니티 배지 페이지 링크(예: `https://comic.naver.com/community/u/just/badge`)를 넣으면
찐팬 배지 목록(썸네일, 작품명, 찐팬 점수, 작품 색)을 한 장 또는 여러 장의 이미지로 만들어 저장하는 **비영리 개인 프로젝트**입니다.

> 약관 검토 결과와 위험 줄이는 장치는 [docs/TERMS_REVIEW.md](docs/TERMS_REVIEW.md)에 정리했어요.
> 배포(AWS EC2 + Docker + Jenkins)는 [docs/INFRA_GUIDE.md](docs/INFRA_GUIDE.md)를 보며 직접 해 보세요.

## 구조

```
webtoon/
├─ backend/   Spring Boot 4 · Java 21 · Gradle (포트 8080)
├─ frontend/  Next.js 16 (App Router) · TypeScript · Tailwind (포트 3000)
└─ docs/      약관 검토, 인프라 가이드
```

```
브라우저 ──/api/badges──▶ backend ──▶ comic.naver.com/community/api (배지 목록, 12~30개씩 순서대로)
        ──/api/image───▶ backend ──▶ shared-comic.pstatic.net (썸네일, 저장하지 않고 전달만)
        └ canvas 로 이미지 그리기 → JPG/PNG/WebP 저장, 여러 장이면 zip
```

썸네일 서버가 CORS 헤더를 주지 않아서, 브라우저가 canvas 로 이미지를 만들려면 백엔드가 썸네일을 대신 받아 전달해야 해요.

## 로컬 실행

터미널 두 개를 엽니다.

```bash
cd backend && ./gradlew bootRun
```

```bash
cd frontend && npm install && npm run dev
```

http://localhost:3000 에 접속해 링크를 넣고 **불러오기** → 옵션 조정 → **다운로드**.
개발 중에는 Next 가 `/api/*` 요청을 `http://localhost:8080` 으로 넘겨줘요 (`frontend/next.config.ts`의 rewrites).

## 백엔드 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/badges?url={배지 링크 또는 아이디}&includeAdult=false` | 프로필 + 찐팬 배지 목록 |
| GET | `/api/image?src={pstatic.net 이미지 주소}` | 썸네일 전달 (pstatic.net 도메인만 허용) |
| GET | `/actuator/health` | 헬스체크 |

오류는 `{ "code": "...", "message": "..." }` 형태예요. 잘못된 링크는 400, 없는 사용자는 404, 비공개 배지는 403, 요청이 너무 많으면 429, 네이버 쪽 오류는 502를 돌려줘요.

## 설정 (환경변수)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `8080` | 백엔드 포트 |
| `APP_CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | 허용할 프론트 주소 (쉼표로 여러 개) |
| `SPRING_PROFILES_ACTIVE` | – | 운영은 `prod` (이때 `APP_CORS_ALLOWED_ORIGINS` 필수) |
| `NEXT_PUBLIC_API_BASE_URL` | 빈 값 | 백엔드를 다른 도메인에 둘 때만 지정 (빌드할 때 코드에 들어감) |
| `BACKEND_INTERNAL_URL` | `http://localhost:8080` | 개발용 rewrite 대상 |

속도 제한, 캐시 시간, 네이버 요청 간격 같은 값은 `backend/src/main/resources/application.yml`의 `app.*`에서 바꿀 수 있어요.

## 테스트

```bash
cd backend && ./gradlew test
```

```bash
cd frontend && npm run lint && npm run build
```
