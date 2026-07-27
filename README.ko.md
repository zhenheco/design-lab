# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · **한국어** · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Claude Code를 위한 개인화된, 브랜드 단위의 디자인 취향 메모리.**

마음에 드는 디자인을 보고 섬세한 평가를 내리면("타이포그래피는 훌륭한데 팔레트가 너무 차갑다"), 그것들이 로컬 메모리에 차곡차곡 쌓입니다. 이후 Claude Code에 프런트엔드 구축을 요청하면 `/design`이 그렇게 누적된 취향을 불러와, 결과물이 한층 더 *당신답게* 보이도록 만듭니다 — 브랜드별로, 매 사이클마다 더 날카로워집니다.

```
   capture                     store                         generate
┌──────────────┐        ┌──────────────────┐         ┌────────────────────┐
│ liked designs│  ───▶  │  Vault (SSOT)     │  ───▶   │ /design <task>     │
│ (URL / image)│        │  cases + aspects  │         │  loads merged      │
│ + verdicts   │        │  style guides     │         │  brand memory →    │
└──────────────┘        │  NEVER rules      │         │  on-taste frontend │
       ▲                └──────────────────┘         └────────────────────┘
       │                         │  ▲
       │                  ┌──────┴──┴───────┐
       └───────────────── │  local sidecar  │  HTTP @ 127.0.0.1:5174
         MCP write tools  │  (Express)      │  + MCP server (7 tools)
                          └─────────────────┘
```

이 시스템은 **브랜드 단위**로 동작합니다: 모든 브랜드로 취향이 흘러 들어가는 기준이 되는 자기 브랜드(`_personal`)와, 케이스가 서로 절대 새어 나가지 않는 명명된 브랜드들로 구성됩니다.

---

## 작동 방식

- **Vault** — 당신의 취향에 대한 단일 진실 공급원(single source of truth)으로, 마크다운 + YAML로 이루어진 평범한 폴더이며 직접 소유하고 `git`으로 관리할 수 있습니다(이 저장소 바깥에 보관됨). 브랜드별 **스타일 가이드(style guides)**, 마음에 든 **케이스(cases)**, **안티 라이브러리(anti-library)**, 그리고 **NEVER 규칙(NEVER rules)**을 담습니다.
- **Sidecar** — 항상 켜져 있는 작은 로컬 Express 데몬(`127.0.0.1:5174`)으로, vault의 검색 범위가 적용된 병합 뷰를 HTTP로 제공합니다(`/api/context`, `/api/distill/:brand`, …). 읽기 엔드포인트는 루프백에 열려 있고, 쓰기에는 로컬 API 토큰이 필요합니다.
- **MCP server** — sidecar를 감싸서 에이전트(예: 로컬 Hermes 에이전트)가 7개의 도구로 컨텍스트를 읽고 새로운 취향을 캡처할 수 있게 합니다.
- **`/design`** — Claude Code 측 소비자: 브랜드의 병합된 메모리를 불러와 생성 프롬프트에 맞게 구성합니다(브랜드 가이드 → 따르기, NEVER 규칙 → 강제 제약, 마음에 든 케이스 → 모방, 안티 케이스 → 회피).

### 핵심 개념

| 용어 | 의미 |
|------|---------|
| **Brand(브랜드)** | 취향의 범위. `_personal` = 자기 브랜드(기준이 되며 모든 브랜드로 흘러 들어감). 명명된 브랜드는 클라이언트별로 구분됩니다. |
| **Case(케이스)** | 캡처된 하나의 디자인(스크린샷 + 추출된 토큰)으로, 당신의 인용구와 평가가 함께 담깁니다. |
| **Aspect(측면)** | 한 케이스에 대한 차원별 평가 — `{dimension, verdict: like\|dislike, note}`. 디자인이 모든 면에서 완벽한 경우는 드뭅니다. |
| **Style guide(스타일 가이드)** | 브랜드별 마크다운 규칙(전역 자기 브랜드 가이드 + 브랜드별 오버라이드). |
| **NEVER rule(NEVER 규칙)** | 탐지기가 딸린 강제 제약으로, 생성된 CSS에 대해 린터가 적용합니다. |
| **Distillation(증류)** | 누적된 호불호 신호를 묶어 NEVER / 스타일 노트 후보로 제안하는 과정 — **승인 게이트가 적용되며** 절대 자동으로 기록되지 않습니다. |

---

## 루프

- **입력** — 로컬 Hermes 에이전트의 일일 크론이 디자인 후보를 띄워 줍니다. 당신이 검토하고 측면별 평가로 응답하면, 에이전트가 MCP 도구를 통해 그것들을 vault에 캡처합니다.
- **출력** — Claude Code에서: `/design "<task>" <brand> <scenario>`가 브랜드의 병합된 메모리를 불러와, 누적된 취향에 맞는 프런트엔드를 생성합니다.
- **복리 효과** — 신호가 쌓이면 `distill_taste`가 그것들을 묶어 지속적인 규칙 후보로 만듭니다. 당신이 승인하면 규칙이 브랜드의 스타일 가이드에 자리 잡고, `/design`이 더 날카로워집니다.

[`open-design`](https://github.com/zhenheco/open-design)은 선택적으로 `design-memory-bridge` 스킬을 통해 동일한 컨텍스트를 세 번째(읽기 전용) 생성 스튜디오로서 소비할 수 있습니다.

---

## 설치

요구 사항: **Node ≥ 20**(sidecar는 `better-sqlite3` 12.x를 사용하며, Node 26도 문제없습니다), 그리고 [Claude Code](https://claude.com/claude-code).

명령 한 줄 — 클론하고 설치 프로그램을 실행하세요:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh`는 의존성을 설치하고, 대시보드를 빌드하고, 스킬을 Claude Code에 연결하고(`~/.claude/skills/design-lab`), vault를 초기화하고, sidecar를 시작하며(macOS에서는 launchd 데몬으로, 그 외 환경에서는 필요 시 자동 생성됨), MCP server를 등록하는 방법을 출력합니다. 이 스크립트는 멱등(idempotent)하므로 `git pull` 이후 다시 실행해도 안전합니다.

확인:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

vault는 기본적으로 `~/Documents/CC Cli/design-library`에 위치하며, `DESIGN_LAB_VAULT_PATH`로 재정의할 수 있습니다. `capture_url` 스크린샷 도구를 사용하려면 `npx playwright install chromium`도 함께 실행하세요.

### MCP server 등록

에이전트를 stdio 진입점 `skill/mcp/start.sh`로 향하게 하세요 — 7개의 도구를 모두 자동으로 탐색합니다. 예를 들어:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### 당신의 취향으로 생성하기

```bash
/design "build a landing hero" <brand> landing
```

---

## MCP 도구

| 도구 | 목적 |
|------|---------|
| `get_context` | 브랜드의 검색 범위가 적용된 컨텍스트(스타일 가이드 + 케이스 + NEVER 규칙)를 읽습니다. |
| `list_clients` | 브랜드 목록을 나열합니다. |
| `add_case` | 로컬 이미지 경로에서 케이스를 캡처합니다. |
| `capture_url` | URL을 스크린샷하고, 실제로 계산된 라이브 디자인 토큰을 추출하여 케이스로 저장합니다. |
| `add_feedback` | 하나의 이미지에 묶이지 않은 취향 신호를 기록합니다. |
| `edit_style_guide` | 전역 또는 브랜드별 스타일 가이드를 편집합니다(해시 충돌 보호 적용). |
| `distill_taste` | 누적된 호불호 신호를 묶어 규칙 후보로 만듭니다(읽기 전용이며, 영구 저장 전에 당신이 승인합니다). |

쓰기에는 로컬 API 토큰(`X-Design-Lab-Token`, 요청마다 `~/.claude/state/design-lab/api-token`에서 읽음)이 필요합니다. Host 허용 목록 + 토큰은 로컬 브라우저로부터의 DNS 리바인딩 공격으로부터 sidecar를 보호합니다.

---

## 프로젝트 구성

```
skill/
  sidecar/      Express HTTP sidecar (routes + auth middleware)
  mcp/          MCP server wrapping the sidecar (7 tools)
  lib/          case loader/writer, distill aggregator, URL capture, lint
  dashboard/    Astro local dashboard (served by the sidecar at /)
  scripts/      design.sh, ensure-sidecar.sh, launchd-install.sh, …
  launchd/      LaunchAgent plist template
docs/
  adr/          architecture decisions (0001–0005)
  superpowers/  specs + plans
```

## 테스트

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## 설계 결정

[`docs/adr/`](docs/adr/)를 참고하세요:

- **0001** — design-lab과 open-design을 별도의 코드베이스로 유지한다.
- **0002** — sidecar를 감싸는 MCP server를 통해 에이전트와 통합한다.
- **0003** — 브랜드별 스타일 가이드를 `/api/context`로 병합한다.
- **0004** — 측면별(차원별) 케이스 피드백.
- **0005** — 승인 게이트가 적용된 증류(sidecar에서의 결정론적 클러스터링, 그리고 어떤 쓰기든 이루어지기 전에 LLM 초안 작성 + 사람의 승인).

## 보안

로컬 우선이며 토큰으로 보호됩니다. 모든 PR마다 무료 SAST(Semgrep + Gitleaks + Trivy)를 실행하고, Dependabot과 시크릿 스캐닝도 함께 적용합니다. vault와 API 토큰은 이 저장소 바깥에 존재하며 절대 커밋되지 않습니다.

---

*상태: v0.4 — 캡처하고, 대화하고, 누적한다.*
