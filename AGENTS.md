# THE MANTIS — 작업 지침

이 파일이 canonical 작업 지침이다. `CLAUDE.md`(Claude Code)와 `AGENTS.md`(Codex)는 같은 파일이다(symlink). Claude Code·Codex 공통.

---

## 한 줄 목적

정적 HTML/JS 사마귀 키우기 배틀 게임. 서버 없음, 빌드 단계 없음. `index.html`을 브라우저로 열면 즉시 실행된다.

---

## 디렉터리 · 주요 파일

| 경로 | 설명 |
|---|---|
| `index.html` | 진입점. 모든 JS를 `<script src="...?v=3">` 순서로 로드 |
| `styles.css` | 전체 스타일 (픽셀 폰트 Press Start 2P, DotGothic16) |
| `js/sprites.js` | 16×16 팔레트 픽셀 아트 스프라이트 데이터 (`Sprites` 전역) |
| `js/mantis.js` | 사마귀 상태·성장·액션 로직 (`Mantis` 전역, `STAGES` 상수) |
| `js/battle.js` | 턴제 배틀 로직 · 적 정의 (`Battle`, `ENEMIES`, `MOVES` 전역) |
| `js/audio.js` | Web Audio API 칩튠 BGM·SFX (`Audio8` 전역, 외부 파일 없음) |
| `js/game.js` | 메인 루프, UI 배선, localStorage 저장/복원 (`SAVE_KEY = 'the-mantis:v1'`) |
| `assets/img/` | Wikimedia Commons 출처 실사 사진 19장 (JPG) — 라이선스 주의 |
| `CREDITS.md` | 이미지 출처 표 (각 파일 → Wikimedia Commons URL) |
| `test-smoke.js` | Node.js 스모크 테스트 (DOM 없는 로직 단위 검증) |
| `.gitignore` | `.playwright-mcp/`, `*.local`, `.DS_Store` 무시 |

### JS 로드 순서 (중요)

`sprites.js` → `mantis.js` → `battle.js` → `audio.js` → `game.js`

각 파일은 전역 변수를 선언하고 다음 파일에서 참조한다. 순서를 바꾸지 말 것.

---

## 게임 구조 요약

- **성장 단계**: 알(egg) → 약충(nymph, Lv.2) → 준성충(subadult, Lv.5) → 성충(adult, Lv.10)
- **액션**: 먹이주기 / 훈련 / 휴식 / 사냥·배틀
- **배틀 이동기**: 낫 베기(slash) / 위협(threaten) / 빠른 일격(dash) / 포식(devour, 성충 전용)
- **적 4티어**: tier1(모기·파리·개미·무당벌레) → tier4(전갈·장수말벌)
- **시간 스케일**: 실제 1초 = 게임 5초, 실제 5분 = 게임 1일
- **저장**: `localStorage` 키 `the-mantis:v1`, 자동 저장

---

## 실행 · 검증

### 브라우저로 실행 (정상 플로우)

빌드 단계가 없다. 파일을 편집한 뒤 브라우저에서 `index.html`을 직접 열거나 리로드한다.

```bash
# macOS: 기본 브라우저로 바로 열기
open "/Users/namgicheol/Developments/the mantis/index.html"
```

동작 확인은 Playwright 또는 Chrome DevTools MCP로 수행한다.

```bash
# Playwright MCP: index.html을 file:// URL로 네비게이션
# 확인 항목: 캔버스 렌더링, 버튼 클릭 반응, 배틀 오버레이 표시
```

### 스모크 테스트 (로직 단위)

DOM 없이 Node.js로 실행한다. JS 로직 변경 시 반드시 통과 확인.

```bash
cd "/Users/namgicheol/Developments/the mantis"
node test-smoke.js
```

성공 시 `RESULT: N passed, 0 failed` 출력, 종료 코드 0.

---

## 이미지 자산 라이선스 주의

`assets/img/` 하위 19개 JPG 파일은 모두 **Wikimedia Commons** 출처이며 각각 퍼블릭 도메인·CC0·CC-BY·CC-BY-SA 중 하나로 배포된다.

- **출처 표기 제거 금지**: `CREDITS.md`의 출처 표는 변경·삭제하지 말 것.
- **이미지 교체 시**: 교체 파일도 동등한 자유 라이선스여야 하며, `CREDITS.md` 표를 즉시 업데이트한다.
- 각 이미지의 정확한 라이선스는 `CREDITS.md`에 기재된 Wikimedia Commons 링크에서 확인한다.

---

## 코드 수정 가이드라인

- **외부 의존성 없음**: CDN 스크립트·npm 패키지를 추가하지 말 것 (Google Fonts 예외 — 이미 존재).
- **전역 변수 유지**: `Sprites`, `Mantis`, `Battle`, `Audio8`, `MOVES`는 전역 네임스페이스에 노출된 상태를 유지해야 `test-smoke.js`가 동작한다.
- **`?v=N` 캐시 버스터**: `index.html`의 스크립트 태그에 버전 쿼리가 있다. JS 파일을 수정했으면 필요 시 버전 숫자를 올린다.
- **스프라이트 형식**: `sprites.js`의 각 스프라이트는 16행×16열 팔레트 인덱스 배열이다. 형식을 바꾸면 렌더러가 깨진다.
- **저장 키 호환성**: `SAVE_KEY`(`the-mantis:v1`)와 `defaultMantisState()` 스키마를 바꾸면 기존 세이브가 깨질 수 있다. 변경 시 마이그레이션 처리 필요.

---

## 검색 · 편집 도구 병기

| 작업 | 도구 |
|---|---|
| 패턴 검색 | `rg` / Grep |
| 파일 편집 | `apply_patch` / Edit·Write |
| 브라우저 검증 | Playwright MCP / Chrome DevTools MCP |
| 로직 테스트 | `node test-smoke.js` |
