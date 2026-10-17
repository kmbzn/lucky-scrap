# Lucky Scrap

한국어 모바일 웹 아이템 수집·조합·공개 물물교환 게임입니다. Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Realtime을 사용합니다. 320~430px 세로 화면을 대상으로 하며 PC에서도 최대 430px로 표시합니다.

## 현재 게임 규칙

- 카카오 첫 로그인으로 계정을 만들고 닉네임을 설정합니다.
- 캔버스에 자유롭게 그린 뒤 제출합니다. **점 하나도 허용**하며 글자 인식·정답 판정은 하지 않습니다. 빈 입력과 범위를 벗어난 좌표는 거부합니다.
- 제출 시 **회전 애니메이션과 5초 진행 표시**가 나타납니다. 서버도 5초를 기다린 뒤 자연물 1개를 지급합니다. 외부 OCR 요청·API 키는 사용하지 않습니다.
- 001~023 자연물 확률과 024~063 제작법은 제공된 명세를 유지합니다. 000은 공식 지급 경로가 없습니다.
- 조합 성공률은 100%이며 재료를 소모합니다. 중간 재료는 자동 제작하지 않습니다.
- 공개 장터는 다종·다수량 에스크로 교환입니다. 등록 즉시 제공품을 보관하고, 누구나 조건 전량을 충족하면 먼저 수락할 수 있습니다. 등록자만 취소할 수 있습니다.
- 한 번 획득한 아이템은 영구 도감에 남습니다. 조합·도감·상세에서 미발견 아이템의 이름과 이미지는 `???`로 표시하고 검색에서도 숨깁니다. **메인 페이지와 메인에서 여는 상세는 미발견 여부와 관계없이 아이템을 공개합니다.** 공식 도감 진행률은 001~063의 63종 기준입니다.
- 랭킹은 현재 제공하지 않습니다. 트로피는 제작·보유·거래할 수 있습니다.

## 실행

Node.js 22 LTS와 npm을 사용합니다.

```bash
npm ci
cp .env.example .env.local
# .env.local에 서버 환경변수를 입력
npm run dev
```

http://localhost:3000 에서 확인합니다. 환경변수 변경 뒤 서버를 재시작하세요.

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

빌드 직전에 Node.js sharp로 아이콘을 생성합니다. Python 설치는 필요 없습니다. `scripts/crop_icons.py`는 별도의 대체 크롭 도구이며 Pillow가 필요합니다.

## 환경변수

| 변수                            | 용도                                                                       | 브라우저 공개 |
| ------------------------------- | -------------------------------------------------------------------------- | ------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 프로젝트 URL                                                      | 예            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable 키                                                        | 예            |
| `SUPABASE_SERVICE_ROLE_KEY`     | 서버 전용 뽑기·제작·장터 변경 권한                                         | 아니요        |
| `NEXT_PUBLIC_SITE_URL`          | 배포 origin `https://lucky-scrap.vercel.app`, 로컬 `http://localhost:3000` | 예            |
| `TEST_DATABASE_URL`             | CREATE DATABASE 권한이 있는 테스트 DB URL                                  | 테스트 전용   |

`lib/config.ts`에 사용자 제공 Supabase 프로젝트 URL과 publishable 키를 공개 기본값으로 연결했습니다. 환경변수가 있으면 그 값을 우선합니다. 비밀 service_role 키는 Vercel 또는 `.env.local`에만 저장하세요. 카카오 REST API 키와 Client Secret은 Supabase Kakao provider에 설정합니다. Google Cloud Vision 키는 더 이상 필요하지 않으며 등록되어 있어도 사용하지 않습니다.

## DB 적용

새 Supabase 프로젝트에서는 SQL Editor에서 `supabase/setup.sql` 전체를 한 번 실행합니다. 이미 적용한 프로젝트에서 초기화를 반복하지 마세요. CLI로 적용할 수도 있습니다.

```bash
npx supabase login
npx supabase link --project-ref dyiustatuxclpmsesoce
npx supabase db push
```

마이그레이션 구성:

- 001: 프로필·아이템·재고·도감·조합·챌린지·장터·원장, RLS, 서버 변경 함수
- 002: 64종 아이템·40종 조합법
- 003: 랭킹 파생 view·갱신 피드 제거(인벤토리·트로피 보존)
- 004: 본인 닉네임만 설정할 수 있는 authenticated 전용 함수

이번 5초 뽑기 변경은 기존 DB 함수와 호환되므로 **추가 SQL 적용이 필요 없습니다.** 챌린지의 기존 글자 필드는 호환성을 위해 남지만 UI에 제시하거나 정답으로 판정하지 않습니다.

## 카카오 자동 가입

1. Kakao Developers에서 Lucky Scrap 앱의 카카오 로그인을 ON으로 설정합니다.
2. 웹 플랫폼 origin에 `https://lucky-scrap.vercel.app`을 등록합니다.
3. 같은 앱의 **REST API 키**와 그 키에 연결된 **Client Secret**을 Supabase Authentication → Sign In / Providers → Kakao에 입력합니다. 앱 이름이나 JavaScript 키를 REST API 키 자리에 넣지 않습니다.
4. Kakao Redirect URI에 `https://dyiustatuxclpmsesoce.supabase.co/auth/v1/callback`을 등록합니다.
5. Kakao 동의항목 중 `profile_nickname`을 활성화합니다. 코드가 `queryParams: { scope: 'profile_nickname' }`로 기본 이메일·사진 요청을 덮어씁니다. Supabase의 **Allow users without an email**을 켜세요.
6. Supabase URL Configuration의 Site URL을 `https://lucky-scrap.vercel.app`으로, Redirect URLs를 `https://lucky-scrap.vercel.app/auth/callback`으로 설정합니다.
7. 신규 가입을 허용하고, 다른 로그인 provider는 비활성화합니다.

`@supabase/ssr`의 PKCE verifier cookie와 `/auth/callback`의 코드 교환으로 세션을 만들고 `proxy.ts`에서 갱신합니다. auth.users 트리거로 프로필이 생성되며 가입 아이템은 지급하지 않습니다. 이메일을 계정 식별자로 사용하지 않습니다. 닉네임은 2~12자의 한글·영문·숫자·밑줄이며 중복을 허용하지 않습니다.

주요 오류:

- KOE101: 잘못된 앱 키 또는 키 타입
- KOE004: Kakao Developers의 로그인 기능 비활성화
- KOE205: 동의항목 설정 불일치
- `invalid_client / Bad client credentials`: REST API 키와 Client Secret 조합·활성화 상태 확인
- localhost 이동: Supabase URL Configuration 확인

실제 OAuth의 상세 실패 원인은 Supabase Auth 로그의 `error`에서 확인합니다. 키·토큰·인증 코드는 공개하지 않습니다.

## 보상·거래 보안

인벤토리 수량과 뽑기 결과는 서버에서만 변경합니다. Route Handler가 `getUser()`로 사용자를 검증하고 로그인 ID를 주입하며 POST origin을 검사합니다. 브라우저의 지급 아이템·소유자·성공 플래그는 받지 않습니다.

뽑기는 서버가 챌린지를 먼저 점유하고 5초 대기 후 기존 `game_mutate` 트랜잭션으로 지급합니다. 같은 그림을 반복해서 제출할 수 있지만 **한 챌린지의 보상은 한 번뿐**입니다. 요청 키와 지급 이벤트 유일 제약으로 재전송·동시 제출의 중복 보상을 막습니다. 5초 대기는 서버에서도 적용하므로 브라우저 애니메이션을 없애도 정상 지급을 앞당길 수 없습니다. 서버 중단 등으로 점유 상태가 남으면 30초 후 새 챌린지로 재시도할 수 있습니다.

DB 함수는 transaction advisory lock과 행 잠금을 사용합니다. 제작 재료 차감·결과 지급, 장터 에스크로·수락·환불은 각각 단일 트랜잭션입니다. 일반 사용자에게 재고 수정이나 서버 전용 함수 실행 권한을 주지 않습니다. 수량은 양의 정수이고 부족 재고·오버플로 시 전부 롤백합니다. 모든 수량 변화는 `inventory_ledger`에 남습니다. 일일 횟수·게임상 보유 상한은 없으며 DB bigint의 기술적 범위와 요청당 수량 1,000,000 상한을 적용합니다.

자연물 정수 가중치 합은 1000이며 pgcrypto 보안 난수와 rejection sampling으로 결정합니다. 공식 화폐·가격·특정 상대 지정 거래는 없습니다.

## 원본 아트와 대표 아이콘

`public/items.png`는 제공된 1254×1254 RGBA 원본을 보존합니다. `scripts/crop-icons.mjs`가 경계 `[0,157,314,470,627,784,940,1097,1254]`를 사용해 원본 해상도의 64개 아이콘을 생성합니다. 000은 완전 투명합니다. UI는 `image-rendering: pixelated`로 표시합니다.

대표 아이콘은 **원본 002번 나뭇잎 아이템 스프라이트**입니다. 별도로 다시 그리지 않습니다. 앱용 파일에만 nearest-neighbor 확대와 홈 화면용 배경·여백을 적용합니다. 원본 시트와 아이템 크롭은 변경하지 않습니다.

- 사이트 헤더: 원본 나뭇잎 스프라이트
- `app/favicon.ico`: 브라우저 탭용 16/32px
- `app/icon.png`: 일반 대표 아이콘 512px
- `app/apple-icon.png`: iOS 홈 화면용 180px, 불투명 배경
- `public/icons/leaf-192.png`, `leaf-512.png`: Android/웹 앱 manifest
- `leaf-maskable-512.png`: Android 아이콘 마스킹용 안전 여백

기존 홈 화면에 추가한 아이콘은 OS 캐시 때문에 업데이트가 늦을 수 있습니다. 필요하면 삭제 후 다시 추가하세요. 오프라인 플레이 기능은 제공하지 않습니다.

## 검증

에셋 전수 픽셀 일치, 가중치·레시피, 훈장 기초 금 64개/트로피 86개, 자유 입력 허용·빈 입력 거부, 서버 5초 대기, 미발견 검색 가림을 테스트합니다.

```bash
TEST_DATABASE_URL=postgresql://USER@localhost:5432/postgres npm test
```

DB 테스트는 별도 `jogak_test_<timestamp>` DB를 생성하고 종료 시 해당 DB만 삭제합니다. 실제 마이그레이션·PostgreSQL 트랜잭션에서 제작 40종, 재료 부족 롤백, 중복 요청, 챌린지·거래 경합, 에스크로 보존, 도감 영구성, 닉네임 권한, RLS를 검사합니다. 앱에는 테스트 지급 API가 없습니다. DB URL이 없으면 통합 묶음은 skip합니다.

로컬 빌드·타입·린트·자동 테스트를 실행했습니다. 실제 모바일 Safari/Chrome의 터치·홈 화면 아이콘은 기기별 확인이 필요합니다. 실서비스의 로그인된 보상 흐름은 배포된 서버 키 설정이 필요합니다.

## 배포

GitHub 저장소 `kmbzn/lucky-scrap`의 main에 push하면 연결된 Vercel이 배포합니다. Root Directory는 `./`, Framework는 Next.js, Node.js는 22.x입니다. `vercel.json`의 npm ci/build 명령을 사용합니다. Production 환경변수 변경 뒤 Redeploy하세요. GitHub Pages 정적 호스팅 대신 Next.js 서버 호스팅을 사용합니다.

공식 참고: [Supabase Kakao](https://supabase.com/docs/guides/auth/social-login/auth-kakao), [Kakao 오류 코드](https://developers.kakao.com/docs/ko/kakaologin/trouble-shooting), [Supabase 리다이렉트 설정](https://supabase.com/docs/guides/auth/redirect-urls).
