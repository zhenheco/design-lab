# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · **Polski**</samp>

**Osobista, przypisana do marki pamięć gustu projektowego dla Claude Code.**

Oglądasz projekty, które Ci się podobają, wydajesz zniuansowane oceny („typografia jest świetna, paleta zbyt chłodna”), a one gromadzą się w lokalnej pamięci. Gdy później poprosisz Claude Code o zbudowanie frontendu, `/design` wczytuje ten nagromadzony gust, dzięki czemu wynik wygląda bardziej jak *Ty* — osobno dla każdej marki, z każdym cyklem coraz precyzyjniej.

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

System jest **przypisany do marek** (brand-scoped): bazowa marka własna (`_personal`), której gust przenika do każdej marki, oraz nazwane marki, których przypadki (cases) nigdy nie przeciekają między sobą.

---

## Jak to działa

- **Vault (skarbiec)** — jedyne źródło prawdy o Twoim guście, zwykły folder z plikami markdown + YAML, który należy do Ciebie i który możesz samodzielnie wersjonować przez `git` (przechowywany poza tym repozytorium). Zawiera przypisane do marek **przewodniki stylu** (style guides), polubione **przypadki** (cases), **antybibliotekę** (anti-library) oraz **reguły NEVER**.
- **Sidecar** — niewielki, stale działający lokalny demon Express (`127.0.0.1:5174`), który serwuje przez HTTP scalony, zawężony do pobierania widok skarbca (`/api/context`, `/api/distill/:brand`, …). Punkty końcowe odczytu są otwarte dla pętli zwrotnej (loopback); zapisy wymagają lokalnego tokenu API.
- **Serwer MCP** — opakowuje sidecar tak, aby agent (np. lokalny agent Hermes) mógł odczytywać kontekst i przechwytywać nowy gust za pomocą 7 narzędzi.
- **`/design`** — konsument po stronie Claude Code: wczytuje scaloną pamięć marki i ujmuje ją w ramy (przewodnik marki → przestrzegaj, reguły NEVER → twarde ograniczenia, polubione przypadki → naśladuj, antyprzypadki → unikaj) w prompcie generującym.

### Pojęcia podstawowe

| Pojęcie | Znaczenie |
|------|---------|
| **Brand (marka)** | Zakres gustu. `_personal` = marka własna (bazowa, przenika do wszystkich). Nazwane marki są specyficzne dla klienta. |
| **Case (przypadek)** | Jeden przechwycony projekt (zrzut ekranu + wyekstrahowane tokeny) wraz z Twoimi cytatami i oceną. |
| **Aspect (aspekt)** | Ocena przypadku na danym wymiarze — `{dimension, verdict: like\|dislike, note}`. Projekt rzadko bywa w całości dobry. |
| **Style guide (przewodnik stylu)** | Reguły markdown przypisane do marki (globalny przewodnik marki własnej + nadpisania dla poszczególnych marek). |
| **NEVER rule (reguła NEVER)** | Twarde ograniczenie z detektorem, egzekwowane na wygenerowanym CSS przez linter. |
| **Distillation (destylacja)** | Grupowanie nagromadzonych sygnałów lubię/nie lubię w proponowane kandydatury reguł NEVER / notatek stylu — **wymaga zatwierdzenia**, nigdy nie jest zapisywane automatycznie. |

---

## Pętla

- **Wejście** — codzienny cron lokalnego agenta Hermes wynosi na wierzch kandydatów projektowych; przeglądasz je i odpowiadasz ocenami dla poszczególnych aspektów; agent przechwytuje je do skarbca za pomocą narzędzi MCP.
- **Wyjście** — w Claude Code: `/design "<task>" <brand> <scenario>` wczytuje scaloną pamięć marki i generuje frontend w nagromadzonym guście.
- **Kumulacja** — w miarę narastania sygnałów `distill_taste` grupuje je w trwałe kandydatury reguł; Ty je zatwierdzasz; reguła trafia do przewodnika stylu marki; `/design` staje się precyzyjniejszy.

[`open-design`](https://github.com/zhenheco/open-design) może opcjonalnie korzystać z tego samego kontekstu jako trzecie (tylko do odczytu) studio generujące, poprzez skill `design-memory-bridge`.

---

## Instalacja

Wymagania: **Node ≥ 20** (sidecar używa `better-sqlite3` w wersji 12.x; Node 26 jest w porządku) oraz [Claude Code](https://claude.com/claude-code).

Jedno polecenie — sklonuj i uruchom instalator:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` instaluje zależności, buduje dashboard, dowiązuje skill do Claude Code (`~/.claude/skills/design-lab`), inicjalizuje skarbiec, uruchamia sidecar (demon launchd na macOS; w innych środowiskach uruchamiany na żądanie) i wypisuje, jak zarejestrować serwer MCP. Jest idempotentny — można go bezpiecznie uruchamiać ponownie po `git pull`.

Weryfikacja:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

Skarbiec domyślnie znajduje się w `~/Documents/CC Cli/design-library`; możesz to nadpisać zmienną `DESIGN_LAB_VAULT_PATH`. Aby korzystać z narzędzia do zrzutów ekranu `capture_url`, uruchom też `npx playwright install chromium`.

### Rejestracja serwera MCP

Skieruj swojego agenta na wejście stdio `skill/mcp/start.sh` — automatycznie wykryje wszystkie 7 narzędzi. Na przykład:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Generowanie zgodne z Twoim gustem

```bash
/design "build a landing hero" <brand> landing
```

---

## Narzędzia MCP

| Narzędzie | Przeznaczenie |
|------|---------|
| `get_context` | Odczytuje zawężony do pobierania kontekst marki (przewodnik stylu + przypadki + reguły NEVER). |
| `list_clients` | Wypisuje listę marek. |
| `add_case` | Przechwytuje przypadek z lokalnej ścieżki obrazu. |
| `capture_url` | Wykonuje zrzut ekranu adresu URL, ekstrahuje obliczone na żywo tokeny projektowe, zapisuje jako przypadek. |
| `add_feedback` | Zapisuje sygnał gustu niepowiązany z żadnym konkretnym obrazem. |
| `edit_style_guide` | Edytuje globalny lub przypisany do marki przewodnik stylu (zabezpieczony przed konfliktem hashy). |
| `distill_taste` | Grupuje nagromadzone sygnały lubię/nie lubię w kandydatury reguł (tylko do odczytu; zatwierdzasz przed utrwaleniem). |

Zapisy wymagają lokalnego tokenu API (`X-Design-Lab-Token`, odczytywanego dla każdego żądania z `~/.claude/state/design-lab/api-token`). Lista dozwolonych hostów (Host allowlist) wraz z tokenem chronią sidecar przed atakami DNS-rebinding ze strony lokalnych przeglądarek.

---

## Układ projektu

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

## Testy

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Decyzje projektowe

Zobacz [`docs/adr/`](docs/adr/):

- **0001** — utrzymanie design-lab i open-design jako odrębnych baz kodu.
- **0002** — integracja z agentem przez serwer MCP opakowujący sidecar.
- **0003** — przypisane do marek przewodniki stylu scalane w `/api/context`.
- **0004** — aspektowa (per-wymiar) ocena przypadków.
- **0005** — destylacja wymagająca zatwierdzenia (deterministyczne klastry w sidecarze, redagowanie przez LLM + ludzka akceptacja przed jakimkolwiek zapisem).

## Bezpieczeństwo

Lokalne w pierwszej kolejności i chronione tokenem. Darmowy SAST przy każdym PR (Semgrep + Gitleaks + Trivy), a do tego Dependabot i skanowanie sekretów. Skarbiec i token API znajdują się poza tym repozytorium i nigdy nie są commitowane.

---

*Status: v0.4 — przechwytuj, rozmawiaj, kumuluj.*
