# 조각섬

한국어 모바일 웹 수집·제작·공개 물물교환 게임입니다. Next.js App Router / TypeScript / Tailwind CSS / Supabase Auth·PostgreSQL·Realtime으로 구현했습니다. 320~430px 세로 화면을 대상으로 하며 PC에서도 최대 430px로 표시합니다.

## 현재 상태

- 000~063 원본 아이콘, 자연물 23종의 정확한 확률, 제작법 40종, 카카오 PKCE 및 쿠키 세션, 닉네임, 손글씨 입력, 서버 OCR 연동, 원자적 제작, 다종 아이템 에스크로 장터, 영구 도감, 현재 트로피 보유량 랭킹을 구현했습니다.
- **외부 프로젝트와 키는 제공되지 않았습니다.** 현재 실행 화면에서는 서비스를 소개하고 도감·제작법을 탐색할 수 있습니다. 가짜 계정·가짜 재고·가짜 OCR 성공은 없습니다. 실제 플레이에는 아래 설정이 필요합니다.
- 실제 PostgreSQL 16에서 마이그레이션과 경제 통합 테스트를 실행했습니다. Supabase 호스팅 연결, 실제 카카오 OAuth, 외부 OCR, 실제 모바일 브라우저의 종단간 검증은 아직 완료하지 못했습니다.
- 외부 배포는 하지 않았습니다. Next.js를 지원하는 Node.js 호스팅에 배포할 수 있는 소스입니다.

## 로컬 실행

Node.js 22 LTS와 npm이 필요합니다. 아이콘은 이미 포함되어 있고 빌드 직전에도 자동 생성합니다.

```bash
npm ci
cp .env.example .env.local
# .env.local에 실제 연결 값 입력
npm run dev
```

http://localhost:3000 을 엽니다. 환경변수를 바꾼 뒤 개발 서버를 재시작하세요.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

환경변수가 없더라도 소개·도감·레시피 화면과 빌드는 작동합니다. 서버 연동이 필요한 작업은 명확한 설정 안내를 표시하고 아이템을 발급하지 않습니다.

## 환경변수

| 변수                            | 용도                                                                                     | 브라우저 공개           |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 프로젝트 URL                                                                    | 예                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 프로젝트 anon 키 또는 publishable 키                                                     | 예                      |
| `SUPABASE_SERVICE_ROLE_KEY`     | 서버에서만 사용하는 service_role 키                                                      | **아니요**              |
| `NEXT_PUBLIC_SITE_URL`          | 사이트의 정확한 origin, 로컬 `http://localhost:3000`, 배포 `https://your-domain.example` | 예                      |
| `GOOGLE_VISION_API_KEY`         | Cloud Vision 서버 OCR API 키                                                             | **아니요**              |
| `TEST_DATABASE_URL`             | 통합 테스트용 PostgreSQL 관리자 연결 URL                                                 | **아니요**, 테스트 전용 |

카카오 REST API 키와 client secret은 Supabase Dashboard의 Kakao provider에 설정합니다. Next.js 브라우저 환경변수에 넣지 않습니다. `.env.local`은 Git에서 제외됩니다. service_role은 RLS를 우회하므로 서버 환경변수에만 보관하세요. 공개 NEXT_PUBLIC 값은 빌드 시 주입되므로 배포 환경을 바꾸면 다시 빌드합니다.

## Supabase 데이터베이스

빈 Supabase 프로젝트를 생성하고 CLI로 마이그레이션을 적용합니다.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`202610170001_game.sql`이 테이블, 권한, RLS, 서버 전용 함수, Realtime publication을 생성하고 `202610170002_catalog.sql`이 64종 아이템과 40종 레시피를 등록합니다. `seed.sql`은 같은 내용을 담은 재실행 가능한 로컬 시드입니다. 기존 서비스 DB와 충돌할 수 있으므로 신규 프로젝트에 적용하세요.

Docker가 있는 환경에서는 `npx supabase start`와 `npx supabase db reset`으로 로컬 Supabase를 만들 수 있습니다. 로컬 OAuth 사용 시 Kakao provider를 CLI 환경에 별도로 설정해야 합니다. 기본 제공 설정은 이메일 가입을 비활성화합니다. 호스팅 프로젝트에서도 Auth > Providers에서 이메일·다른 소셜 provider를 끄고 **Kakao만** 켭니다.

### 보안과 원자성

- 브라우저에는 읽기 권한과 본인 재고/도감 RLS만 제공합니다. 테이블 INSERT·UPDATE·DELETE와 `game_mutate`, `inventory_delta` 실행을 anon/authenticated에서 회수합니다.
- Route Handler가 Supabase `getUser()`로 세션을 검증하고 실제 `user.id`를 주입합니다. 사용자가 보낸 소유자·성공 플래그·지급 아이템은 받지 않습니다. POST는 origin을 검증합니다.
- `game_mutate`는 단일 DB 트랜잭션이며 거래행 `FOR UPDATE`, 챌린지행 잠금, 경제 전체의 transaction advisory lock으로 재고를 보호합니다. 초기에 일관성을 우선한 전체 잠금입니다. 대규모 트래픽에서는 정렬된 계정별 잠금으로 세분화할 수 있습니다.
- `(user_id, request_id)` 유일 키와 action/payload 비교로 제작·등록·수락·취소의 재전송을 처리합니다. 클라이언트는 응답을 받지 못한 동일 작업을 같은 키로 재시도합니다. 챌린지는 상태 잠금과 `draw_events.challenge_id UNIQUE`로 중복 지급을 차단합니다.
- 재료 부족, 음수 수량, 정수 오류, bigint 오버플로 시 전체 트랜잭션이 취소됩니다. 보유량에는 게임상 제한이 없습니다(PostgreSQL bigint의 기술적 범위는 적용됩니다). 요청 하나의 제작량·교환 항목 수량은 1~1,000,000의 정수이며 반복 요청이 가능합니다.
- 재고는 원본 bigint를 text로 제공하는 RLS view로 읽어 큰 수량의 표시 정밀도를 유지합니다. 제작 가능량 계산은 한 번의 요청 상한까지만 사용합니다.
- 모든 생성·소모·에스크로 차감·전달·환불은 `inventory_ledger`에 남습니다. 정상 지급 API와 관리자 치트 API는 없습니다. 000은 뽑기·제작·가입으로 생성되지 않으며, 정상 보유가 있다면 거래 구조는 허용합니다.
- 공개 `trophy_updates`는 랭킹 갱신 알림만 제공합니다. 다른 유저의 전체 재고를 노출하지 않습니다.

## 카카오 로그인 설정

공식 문서: [Supabase Kakao](https://supabase.com/docs/guides/auth/social-login/auth-kakao), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side), [Kakao REST 로그인](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api).

1. Kakao Developers에서 애플리케이션을 만들고 카카오 로그인을 활성화합니다. 웹 플랫폼에 `http://localhost:3000`과 실제 HTTPS 도메인을 등록합니다.
2. Kakao Developers > 카카오 로그인 > Redirect URI에 **`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`**을 등록합니다. 이 주소는 Next.js의 callback과 다릅니다.
3. 필요한 동의항목을 설정합니다. 게임 계정 키로 이메일을 사용하지 않습니다. 이메일 동의가 없는 앱에도 맞도록 이메일을 필수 조건으로 두지 마세요.
4. Kakao Developers에서 client secret을 활성화했다면 발급된 값을 준비합니다.
5. Supabase Dashboard > Authentication > Providers > Kakao를 켜고 REST API 키를 client ID로, 활성화한 client secret을 해당 비밀 키 필드에 입력합니다.
6. Supabase > Authentication > URL Configuration에서 Site URL을 실제 사이트 origin으로 설정합니다. Redirect URLs allow list에 `http://localhost:3000/auth/callback`과 `https://YOUR_DOMAIN/auth/callback`을 추가합니다.
7. Next.js의 `.env.local` 또는 호스팅 환경에 위 Supabase URL/anon/service_role와 `NEXT_PUBLIC_SITE_URL`을 설정합니다.
8. 카카오 버튼 → Supabase → Kakao → Supabase callback → `/auth/callback` 순으로 이동합니다. `@supabase/ssr`의 PKCE verifier cookie를 유지하고 `exchangeCodeForSession`에서 코드를 교환합니다. `proxy.ts`가 서버에서 세션을 검증·갱신합니다.
9. 첫 로그인 시 auth.users 트리거로 프로필만 생성하며 아이템은 주지 않습니다. 닉네임(2~12자, 한글/영문/숫자/밑줄, 중복 불가) 설정 후 플레이합니다. 로그아웃과 재로그인, 새로고침 후 복구 코드를 포함합니다.

로컬과 배포를 각각 실제 카카오 계정으로 검증해야 합니다. 로컬에서 로그인 완료 후 새로고침, 로그아웃, 다시 로그인까지 확인하세요. OAuth 실패 시 로그인 화면으로 돌아옵니다.

## 실제 손글씨 인식

[Google Cloud Vision의 손글씨 OCR](https://docs.cloud.google.com/vision/docs/handwriting)을 사용합니다. 가짜 인식기·정답 우회·개발용 보상 경로는 없습니다.

1. Google Cloud 프로젝트에서 결제와 **Cloud Vision API**를 활성화합니다.
2. 서버용 API 키를 만들고 API 제한을 Cloud Vision API로 설정합니다. 가능한 경우 서버 송신 IP 제한도 적용합니다.
3. `GOOGLE_VISION_API_KEY`에 입력하고 Next.js를 재시작합니다. Cloud Vision 이용 비용은 해당 프로젝트에 청구됩니다.
4. 한국어 힌트 `ko`, `DOCUMENT_TEXT_DETECTION`으로 판정합니다. NFC 정규화와 공백 제거 후 서버의 문제 글자와 **정확히 일치하는 한 음절**일 때만 성공합니다. 실제 필기 품질에 따라 인식 실패가 발생할 수 있으므로 출시 전 기기별 한글 손글씨 검증이 필요합니다.

서버는 지원 문자 집합 `가나다라마바사아자차카타파하구누두루무부수우주추쿠투푸후`에서 한 글자를 발급합니다. 챌린지는 5분 후 만료됩니다. 캔버스는 320×320 논리 좌표이며 터치 시 스크롤을 막고 포인터 좌표와 시간순 획, PNG를 전송합니다.

신뢰 경계는 업로드 PNG가 아니라 **서버가 검증된 좌표에서 다시 렌더링한 이미지**입니다. 외부 파일을 캔버스 대신 업로드하는 UI는 없습니다. 서버는 좌표 범위, 순서, 최소 8개 점/200ms, 최대 점·획 수와 요청 크기를 검사합니다. 타임스탬프를 제외한 렌더 이미지의 해시를 전체 서비스에서 유일하게 저장해 같은 필기 리플레이를 거부합니다. OCR 시작 전에 챌린지를 원자적으로 점유하므로 동시에 여러 번 제출해도 한 번만 판정합니다. 판정 실패·서비스 오류가 난 챌린지는 재사용하지 않고 새 문제를 받습니다.

이 검증은 브라우저에서 실제 사람이 썼다는 암호학적 증명이 아닙니다. 변형된 좌표를 생성하는 고도화된 자동화까지 완전히 차단하지는 못합니다. 인식 API 장애/타임아웃(15초)/키 미설정 시 보상을 지급하지 않습니다. 계정당 동시에 하나의 OCR만 진행합니다. 서버가 중단되어 verifying에 남은 경우 30초 후 새 문제를 요청하면 이전 요청을 무효화합니다. 정상 이용자의 일일 횟수·에너지·광고 제한은 없습니다.

## 아이템과 밸런스

- `public/items.png`는 제공한 1254×1254 RGBA 원본과 바이트 단위로 동일합니다. 원본 변경·리사이즈·재생성은 없습니다.
- `scripts/crop-icons.mjs`가 `[0,157,314,470,627,784,940,1097,1254]` 경계로 원본 픽셀을 크롭합니다. 156~157px 크기·alpha를 유지하고 `000.png`는 완전히 투명합니다.
- UI만 32~64px(강조 화면은 더 크게)로 표시하고 `image-rendering: pixelated`를 적용합니다.
- 23종 자연물의 정수 가중치 합은 1000입니다. PostgreSQL pgcrypto의 보안 난수와 rejection sampling으로 균등한 0~999를 만든 뒤 누적 가중치로 선택합니다. 000·제작품은 나오지 않습니다.
- `lib/items.json`과 DB catalog migration/seed는 같은 정의로 생성합니다. 변경 시 `python scripts/generate_data.py`를 실행하세요. 운영 중 레시피 변경은 기존 마이그레이션 수정 대신 새 마이그레이션을 작성해야 합니다.
- 중간 재료는 자동 제작하지 않습니다. 제작 1회 또는 현재 재료로 가능한 만큼 명시적으로 제작합니다.
- 훈장의 기초 금 64개, 트로피의 누적 기초 금 86개를 재귀 테스트로 검증했습니다. 하루 120회 기준 금 공급 기대치는 각각 약 44.4일과 59.7일입니다. 제작 시점은 다른 재료와 운·거래에 따라 달라집니다.

## 공개 장터·도감·랭킹

등록 즉시 제공품 전량이 인벤토리에서 빠지고 에스크로가 됩니다. 수락자는 원하는 항목 전량을 소유해야 하며, 모두 한 번에 교환합니다. 등록자만 취소·환불할 수 있고 본인 수락은 금지합니다. 비공개 상대 지정·부분 거래·공식 화폐·가격은 없습니다.

장터에서 여러 종류의 제공/요구 품목을 추가하고 수량을 지정합니다. 공개 최신 거래, 아이템 검색, 내 거래, 완료·취소 기록을 볼 수 있습니다. 초기 목록은 최근 100건이며 이전 거래를 100건씩 더 불러올 수 있습니다. 검색과 필터는 불러온 목록에 적용됩니다. 랭킹도 100명씩 추가 조회하며 나의 순위는 별도로 조회합니다. 실시간 변경 시 최신 100건으로 갱신됩니다.

도감은 한 번 획득하면 계속 남고 공식 완성률은 001~063만 계산합니다. 000은 비밀 카드입니다. 8×8 카드의 이름이 작은 화면에서는 작으므로 탭하면 큰 아이콘·이름·수량·레시피가 표시됩니다. 내정보에서 보유 인벤토리 전체를 확인할 수 있습니다.

랭킹은 인벤토리 063 **현재 수량** 내림차순입니다. 같은 수량은 공동 순위이며 다음 순위는 건너뜁니다(SQL `rank()`: 1,1,3). 동률 목록은 닉네임 오름차순으로 표시합니다. 에스크로에 맡긴 트로피는 인벤토리에서 빠지므로 랭킹에서도 빠지고, 취소 시 복구됩니다. 트로피 재고가 바뀌면 공개 갱신 피드를 통해 다른 유저의 랭킹도 다시 조회합니다.

## 자동 테스트와 검증 결과

작성일: 2026-10-17 (Asia/Seoul).

```bash
npm run lint
npm run typecheck
npm test
# CREATE DATABASE 권한을 가진 테스트 전용 PostgreSQL, 절대 공개 서버의 비밀 URL을 커밋하지 마세요.
TEST_DATABASE_URL=postgresql://USER@localhost:5432/postgres npm test
```

DB 테스트는 `jogak_test_<timestamp>`라는 새 임시 데이터베이스를 만들고 종료 시 그 DB만 제거합니다. Supabase Auth용 최소 schema/role을 테스트 DB 안에서 흉내 낸 뒤 **실제 마이그레이션과 PostgreSQL 트랜잭션**을 실행합니다. Auth provider 자체를 테스트하는 것은 아닙니다. 테스트용 아이템은 DB 소유자 연결에서만 만들며 앱에 테스트 지급 기능은 없습니다.

검증 항목:

- 원본 규격·바이트 보존·RGBA, 64개 아이콘 전수 원본 픽셀 일치, 000 alpha=0
- 23개 가중치 1000, 모든 40개 레시피 실제 DB에서 재료 차감/결과 지급, 재료 부족 롤백, 금 64/86개
- 비정상 손글씨 좌표·시간 거부, 타임스탬프를 바꾼 같은 이미지 해시 일치, OCR 키 미설정 시 실패
- 챌린지 실패·만료·재사용 거부, 동시 제출 보상 최대 한 번
- 장터 즉시 에스크로, 두 수락자 경합 1건 성공, 취소/수락 경합 재고 보존, 본인 수락·타인 취소 거부, 음수·중복 품목 롤백
- 제작/거래 요청 idempotency 및 다른 payload 거부
- 도감 영구 보존, 트로피 에스크로/환불 시 랭킹 변경
- authenticated 역할의 타인 재고 읽기 및 직접 재고 수정/발행/서버 RPC 실행 거부

실행 결과는 아래 최종 검증 기록을 참고하세요. DB 없는 `npm test`는 DB 통합 묶음만 명시적으로 skip합니다.

### 남은 실제 서비스 검증

제공받지 못한 외부 설정 때문에 실제 Kakao 로그인, Supabase Realtime 네트워크 전달, Google OCR의 한글 판정과 보상까지 이어지는 종단간 테스트는 미완료입니다. 사용 가능한 브라우저 자동화 세션도 없어 320/375/390/430px 화면의 실기기·스크린샷 QA는 수행하지 못했습니다. CSS는 이 폭 범위를 대상으로 구현했지만 실제 터치·Safari 키보드·safe-area 검증은 배포 전 필요합니다.

의존성 검사에서 프로덕션 패키지(`npm audit --omit=dev`)는 취약점 0건입니다. 전체 audit에는 개발 도구 eslint-config-next → fast-glob → micromatch → braces의 고위험 경고 5건이 남아 있습니다. 현재 레지스트리가 패치 없는 braces를 보고하므로 Next.js ESLint 설정을 깨는 강제 downgrade는 적용하지 않았습니다. 서비스 런타임 의존성에는 포함되지 않습니다.

## 배포

Node.js를 지원하는 호스팅(Vercel 또는 Node 서버)에 프로젝트 루트를 연결합니다. `npm ci` 후 `npm run build`, Node 서버의 경우 `npm start`를 사용합니다. Supabase 마이그레이션을 먼저 적용하고 호스팅 환경변수를 모두 설정하세요. OAuth allow list, Kakao Redirect URI, 사이트 origin, Google API 제한을 배포 도메인 기준으로 맞춥니다. HTTPS를 사용합니다. 이 저장소는 Next.js 서버를 요구하며 정적 HTML export만으로는 게임 서버가 작동하지 않습니다.

주요 파일: `components/Game.tsx`(전체 모바일 화면), `app/api/game/route.ts`(서버 인증/검증), `lib/handwriting.ts`(서버 렌더·OCR), `proxy.ts`(세션 갱신), `supabase/migrations/`(경제·RLS·시드), `tests/`(에셋·밸런스·실제 DB 검증).

### 최종 로컬 검증 기록

- `npm run lint`: 통과 (오류·경고 없음)
- `npm run typecheck`: 통과
- PostgreSQL 16.15를 연결한 `npm test`: **17개 통과, 실패 0, skip 0**
- `npm run build`: 통과, `/api/game`·`/auth/callback` 동적 라우트 포함
- 개발 서버 `/`: HTTP 200
- 미설정 게임 API: 설정 필요 응답, 악성 Origin POST: HTTP 403
- `npm audit --omit=dev`: 취약점 0건
- `.github/workflows/ci.yml`: PostgreSQL 서비스에서 동일 검증을 실행하도록 구성 (GitHub 실행 결과는 아직 확인하지 않음)

### GitHub Pages 호스팅 관련

GitHub Pages는 정적 파일 호스팅입니다. 현재 구현의 서버 API, service_role, OCR 비밀 키, 서버 세션을 Pages에서 실행할 수 없습니다. `output: export`로 바꾸는 것만으로는 실제 게임이 작동하지 않습니다. 현재 명세를 유지하려면 `kmbzn/lucky-scrap` 소스 저장소를 Vercel 등 Next.js 서버 호스팅에 연결하세요. Pages를 사용할 경우 서버 기능을 Supabase Edge Functions 같은 별도 서버로 옮기고 OAuth·세션을 정적 클라이언트 환경에 맞게 재설계해야 합니다. 비밀 키를 Pages 빌드의 공개 JavaScript에 넣으면 안 됩니다.

## 선택한 배포 구성: GitHub + Vercel

GitHub Pages는 사용하지 않습니다. 소스 저장소는 `https://github.com/kmbzn/lucky-scrap`, 서버 호스팅은 Vercel, 데이터베이스·인증·실시간은 Supabase입니다.

1. Vercel에서 Add New → Project → `kmbzn/lucky-scrap`을 Import합니다. GitHub 접근 권한은 이 저장소로 지정합니다.
2. Root Directory는 저장소 루트, Framework Preset은 Next.js, Node.js는 22.x로 설정합니다. `vercel.json`이 install/build 명령을 지정합니다. 아이콘은 Node.js sharp로 생성하므로 Python 설치가 필요 없습니다.
3. Supabase 마이그레이션 두 개를 적용하고 README의 Kakao provider 설정을 완료합니다.
4. Vercel Settings → Environment Variables에 `.env.example`의 다섯 변수를 입력합니다. 서버 비밀 키 두 개에는 NEXT_PUBLIC 접두사를 붙이지 않습니다. 프로덕션과 Preview 환경은 필요에 따라 별도 Supabase 프로젝트를 사용합니다.
5. 첫 배포로 확정된 프로덕션 도메인(예: `https://lucky-scrap.vercel.app`; 실제 주소는 Vercel 결과 기준)을 확인하고 `NEXT_PUBLIC_SITE_URL`을 정확히 맞춘 뒤 Redeploy합니다. URL에 `/lucky-scrap` 경로를 붙이지 않습니다.
6. Supabase Site URL과 Redirect allow list에 실제 도메인 및 `/auth/callback`을, Kakao 웹 플랫폼에 실제 사이트 origin을 등록합니다. Kakao OAuth Redirect URI 자체는 Supabase의 `/auth/v1/callback` 주소입니다.
7. 배포된 주소에서 카카오 로그인 → 닉네임 → 손글씨 인식 → 재고 → 제작 → 서로 다른 두 계정의 공개 거래 → 랭킹을 검증합니다. 환경변수가 없으면 소개 화면만 표시되며 실제 플레이는 활성화되지 않습니다.

GitHub의 main에 push하면 연결된 Vercel 프로젝트가 자동 배포합니다. Preview 도메인으로 실제 OAuth를 시험하려면 해당 URL을 별도로 허용하고 그 환경의 사이트 URL을 맞추세요. Vercel CLI를 쓰는 경우 `.vercel/`은 비밀 환경 파일이 포함될 수 있어 Git에서 제외합니다. OCR API 라우트의 실행 한도는 60초로 설정했고 외부 OCR 요청 자체는 15초에 타임아웃됩니다.

참고: [Vercel GitHub 연결](https://vercel.com/docs/git/vercel-for-github), [Vercel 환경변수](https://vercel.com/docs/environment-variables).
