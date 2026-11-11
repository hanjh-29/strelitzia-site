# Strelitzia 공식 정보 사이트

마인크래프트 능력자 모드 **Strelitzia** 의 공지·업데이트·도감 사이트예요.
모드 코드와 **완전히 따로** 있어요 (모드 폴더·모드 기능을 건드리지 않아요).

- 사이트: https://hanjh-29.github.io/strelitzia-site/
- 관리자: https://hanjh-29.github.io/strelitzia-site/admin.html

## 구조

```
index.html          사이트 (홈 · 공지·업데이트 · 모드 정보 · 도감) — 주소 # 뒤로 페이지를 나눠요
admin.html          관리자 페이지 (GitHub 토큰으로 로그인 → 공지·도감 작성/수정/삭제, 백업·복구)
assets/common.js    공용 도구 (분류 색·픽셀 아이콘·정렬)
assets/app.js       사이트 화면
assets/admin.js     관리자 화면
assets/site.css     디자인 (딥슬레이트 + 진한 초록, 게임 화면 HUD 배치: 위 구석 HUD · 아래 핫바 메뉴 · 인벤토리 칸 도감)
data/notices.json   ★ 공지·업데이트 (사이트와 게임 안 공지가 같이 읽어요)
data/codex.json     ★ 능력·무기 도감
data/site.json      ★ 메인 소개 · 모드 정보 페이지 내용
img/                그림 (능력 대표 그림·스킬 아이콘·무기 모델 그림, 관리자 페이지에서 올린 그림은 img/uploads/)
```

## 중앙 데이터 (게임과 같이 써요)

게임 안 공지 화면은 아래 주소를 내려받아요 (게임 쪽은 다음 단계에서 만들어요):

```
https://hanjh-29.github.io/strelitzia-site/data/notices.json
https://hanjh-29.github.io/strelitzia-site/data/codex.json
```

### notices.json 한 글

| 칸 | 뜻 |
|---|---|
| id | 글 주소 (영문·숫자·.-_) — 게임 안 「읽음」 기록에도 써요 |
| kind | `update` 업데이트 / `notice` 공지 |
| version · date | 버전 (공지는 null 가능) · 날짜 `YYYY-MM-DD` (모르면 null) |
| title · summary · body | 제목 · 한 줄 요약 · 자세한 설명 (빈 줄 = 문단, `**굵게**`) |
| mainTag · tags | 대표 분류 · 들어 있는 분류들 (`NEW` `UPDATE` `FIX` `BALANCE` `NOTICE`) |
| changes | `[{tag, text}]` 바뀐 내용 (분류별로 묶여서 보여요) |
| images | `[{src, caption}]` |
| important · pinned | 강조 · 맨 위 고정 |

최근 7일 안에 올라온 글은 사이트에서 `N` 표시가 붙어요.

## 관리하는 법

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → 이 저장소만, **Contents: Read and write**
2. `admin.html` 에서 토큰으로 로그인 (쓰기 권한이 없는 토큰은 들어올 수 없어요)
3. 글을 쓰고 「저장」 → GitHub 에 바로 커밋 → 1~2분 뒤 사이트·게임에 반영

## 백업·복구

- 저장할 때마다 git 기록이 남아요 → 관리자 「백업·복구」 탭에서 예전 시점으로 되돌리기
- 「백업 파일 받기」로 세 파일을 한 번에 내려받고, 「백업 파일로 되돌리기」로 다시 올릴 수 있어요
- 저장 전에 형식 검사를 해서 잘못된 데이터(빈 제목·겹치는 id·틀린 날짜 등)는 올라가지 않아요

## 새 능력·무기가 생기면

관리자 → 「능력 도감」 / 「무기 도감」 → 「새 능력 추가」. 대표 그림·스킬 아이콘은 「올리기」로 바로 올릴 수 있어요.
그림 원본은 모드의 `assets/strelitzia/textures/ability` · `textures/skill` 에 있어요.

## 글꼴

갈무리 (Galmuri, SIL Open Font License) · Pretendard (SIL Open Font License) — CDN 으로 불러와요.

## 읽음 표시

- 최근 7일 안에 올라온 글 중 아직 안 연 글에 **N** 이 붙고, 위 구석 알림과 핫바 「공지」 칸에 개수가 떠요.
- 글을 열면 그 글은 읽음이 돼요. 공지 화면의 「모두 읽음으로 표시」로 한 번에 지울 수도 있어요.
- 읽음 기록은 각자 브라우저(localStorage `strelitzia.read.v1`)에만 저장돼요. 서버나 다른 기기와는 공유되지 않아요.

## 파일을 고친 뒤 (캐시)

`index.html`·`admin.html` 에서 css·js 주소 끝의 `?v=날짜` 를 새 값으로 바꿔 주세요.
안 바꾸면 방문자 브라우저에 옛 css·js 가 남아서 새 화면과 섞여 깨져 보일 수 있어요.

## 모드 파일 (다운로드)

- 받기 화면: 사이트 `#/download` (핫바 5번 「받기」). 최신 버전 받기 버튼 + 설치 방법 + 지난 버전 목록.
- 목록: `data/downloads.json` (`files` = 버전별 jar, `requirements` = 설치에 필요한 마크·Fabric 버전)
- 파일: `downloads/strelitzia-버전.jar` — 지난 버전도 지우지 않고 남겨요.
- 업데이트 공지에 같은 버전 파일이 있으면 공지 화면에 「이 버전 받기」 버튼이 붙어요.
- `tested` 가 false 면 받기 화면에 「게임 확인 전」 표시가 떠요.

### 올리는 방법 1 — 관리자 페이지

1. 마인크래프트를 끄고 `gradlew build`
2. 관리자 페이지 → 「모드 파일」 → `Strelitzia\build\libs\strelitzia-버전.jar` 를 끌어다 놓기 (`-sources` 붙은 파일 말고)
3. 버전이 파일 이름에서 자동으로 채워져요 → 「올리기」. 게임에서 확인했으면 「게임 확인함」 표시

### 올리는 방법 2 — Claude 에게 「사이트에 올려줘」

PC 의 `Strelitzia\build\libs\strelitzia-버전.jar` 를 가져와서 `downloads/` 에 넣고,
`data/downloads.json` 에 항목(version·date·file·name·size·sha256·notice·note·tested)을 추가한 뒤 main 에 커밋·푸시해요.

## 모드를 고치면 공지도 같이 (사용자 요청 2026-11-12)

모드를 고쳐서 버전을 올릴 때마다 이 사이트 `data/notices.json` 에도 그 버전의 업데이트 글을 같이 올려요.
(id `v버전`, kind `update`, 바뀐 점은 모드 README 버전 기록과 같게. 새 기능 NEW · 개선 UPDATE · 오류 FIX · 밸런스 BALANCE)

## 검색 엔진에 안 뜨게 (2026-11-12)

`index.html`·`admin.html` 에 `<meta name="robots" content="noindex, nofollow">` 를 넣었어요.
구글 같은 검색 결과에 안 나오게 하는 표시예요. **주소를 아는 사람은 그대로 들어올 수 있어요** (막는 게 아니라 숨기기).
robots.txt 는 GitHub 사이트 맨 위(hanjh-29.github.io)에만 효과가 있어서 안 썼어요.
