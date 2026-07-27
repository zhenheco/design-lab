# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · **Deutsch** · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Ein persönlicher, markenbezogener Gestaltungsgeschmack-Speicher für Claude Code.**

Du siehst Designs, die dir gefallen, gibst nuancierte Urteile ab („die Typografie ist großartig, die Farbpalette ist zu kalt") und sie sammeln sich zu einem lokalen Speicher an. Wenn du Claude Code später bittest, ein Frontend zu bauen, lädt `/design` diesen angesammelten Geschmack, damit das Ergebnis mehr nach *dir* aussieht – pro Marke, mit jedem Zyklus schärfer.

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

Es ist **markenbezogen**: eine grundlegende Eigenmarke (`_personal`), deren Geschmack in jede Marke einfließt, plus benannte Marken, deren Cases (Fälle) niemals untereinander durchsickern.

---

## Funktionsweise

- **Vault** – die einzige Quelle der Wahrheit für deinen Geschmack, ein schlichter Ordner aus Markdown + YAML, der dir gehört und den du selbst mit `git` verwalten kannst (außerhalb dieses Repos gehalten). Enthält pro Marke **Style guides** (Stilrichtlinien), gefällige **Cases** (Fälle), eine **Anti-Library** (Anti-Bibliothek) und **NEVER rules** (NIEMALS-Regeln).
- **Sidecar** – ein kleiner, dauerhaft laufender lokaler Express-Daemon (`127.0.0.1:5174`), der eine abrufbezogene, zusammengeführte Ansicht des Vaults über HTTP bereitstellt (`/api/context`, `/api/distill/:brand`, …). Lese-Endpunkte sind für Loopback offen; Schreibvorgänge benötigen ein lokales API-Token.
- **MCP server** – umhüllt den Sidecar, sodass ein Agent (z. B. ein lokaler Hermes-Agent) Kontext lesen und neuen Geschmack mit 7 Tools erfassen kann.
- **`/design`** – der Claude-Code-Konsument: lädt den zusammengeführten Speicher der Marke und rahmt ihn ein (Markenrichtlinie → befolgen, NEVER rules → harte Einschränkungen, gefällige Cases → nachahmen, Anti-Cases → vermeiden) in den Generierungs-Prompt.

### Kernkonzepte

| Begriff | Bedeutung |
|------|---------|
| **Brand** | Ein Geschmacks-Geltungsbereich. `_personal` = Eigenmarke (Grundlage, fließt in alle ein). Benannte Marken sind kundenspezifisch. |
| **Case** | Ein erfasstes Design (Screenshot + extrahierte Tokens) mit deinen Zitaten und deinem Urteil. |
| **Aspect** | Ein dimensionsbezogenes Urteil zu einem Case – `{dimension, verdict: like\|dislike, note}`. Ein Design ist selten durchweg gut. |
| **Style guide** | Markdown-Regeln pro Marke (globale Eigenmarken-Richtlinie + Überschreibungen pro Marke). |
| **NEVER rule** | Eine harte Einschränkung mit einem Detektor, durchgesetzt am generierten CSS durch den Linter. |
| **Distillation** | Das Clustern angesammelter Gefällt-mir-/Gefällt-mir-nicht-Signale zu vorgeschlagenen NEVER-/Stilhinweis-Kandidaten – **freigabepflichtig**, niemals automatisch geschrieben. |

---

## Die Schleife

- **Input** – der tägliche Cron-Job eines lokalen Hermes-Agents bringt Design-Kandidaten zum Vorschein; du prüfst sie und antwortest mit aspektbezogenen Urteilen; er erfasst sie über die MCP-Tools im Vault.
- **Output** – in Claude Code: `/design "<task>" <brand> <scenario>` lädt den zusammengeführten Speicher der Marke und generiert ein Frontend im angesammelten Geschmack.
- **Compound** – während sich Signale aufbauen, clustert `distill_taste` sie zu dauerhaften Regelkandidaten; du genehmigst sie; die Regel landet im Style guide der Marke; `/design` wird schärfer.

[`open-design`](https://github.com/zhenheco/open-design) kann optional denselben Kontext als drittes (schreibgeschütztes) Generierungs-Studio über die `design-memory-bridge`-Skill nutzen.

---

## Installation

Voraussetzungen: **Node ≥ 20** (der Sidecar nutzt `better-sqlite3` 12.x; Node 26 ist in Ordnung) und [Claude Code](https://claude.com/claude-code).

Ein Befehl – klonen und den Installer ausführen:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` installiert Abhängigkeiten, baut das Dashboard, verknüpft die Skill mit Claude Code (`~/.claude/skills/design-lab`), initialisiert einen Vault, startet den Sidecar (ein launchd-Daemon unter macOS; anderswo bei Bedarf automatisch gestartet) und gibt aus, wie der MCP server registriert wird. Es ist idempotent – kann nach `git pull` gefahrlos erneut ausgeführt werden.

Überprüfen:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

Der Vault liegt standardmäßig unter `~/Documents/CC Cli/design-library`; mit `DESIGN_LAB_VAULT_PATH` überschreibbar. Um das `capture_url`-Screenshot-Tool zu nutzen, führe außerdem `npx playwright install chromium` aus.

### Den MCP server registrieren

Richte deinen Agent auf den stdio-Einstiegspunkt `skill/mcp/start.sh` – er erkennt alle 7 Tools automatisch. Zum Beispiel:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Mit deinem Geschmack generieren

```bash
/design "build a landing hero" <brand> landing
```

---

## MCP-Tools

| Tool | Zweck |
|------|---------|
| `get_context` | Den abrufbezogenen Kontext der Marke lesen (Style guide + Cases + NEVER rules). |
| `list_clients` | Marken auflisten. |
| `add_case` | Einen Case aus einem lokalen Bildpfad erfassen. |
| `capture_url` | Eine URL als Screenshot festhalten, live berechnete Design-Tokens extrahieren, als Case speichern. |
| `add_feedback` | Ein Geschmackssignal protokollieren, das nicht an ein einzelnes Bild gebunden ist. |
| `edit_style_guide` | Den globalen oder markenbezogenen Style guide bearbeiten (gegen Hash-Konflikte geschützt). |
| `distill_taste` | Angesammelte Gefällt-mir-/Gefällt-mir-nicht-Signale zu Regelkandidaten clustern (schreibgeschützt; du genehmigst vor dem Persistieren). |

Schreibvorgänge erfordern das lokale API-Token (`X-Design-Lab-Token`, pro Anfrage aus `~/.claude/state/design-lab/api-token` gelesen). Die Host-Allowlist + das Token schützen den Sidecar vor DNS-Rebinding durch lokale Browser.

---

## Projektaufbau

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

## Tests

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Designentscheidungen

Siehe [`docs/adr/`](docs/adr/):

- **0001** – design-lab und open-design als getrennte Codebasen halten.
- **0002** – über einen MCP server, der den Sidecar umhüllt, mit dem Agent integrieren.
- **0003** – markenbezogene Style guides, zusammengeführt in `/api/context`.
- **0004** – aspektuelle (dimensionsbezogene) Case-Rückmeldung.
- **0005** – freigabepflichtige Distillation (deterministische Cluster im Sidecar, LLM-Entwurf + menschliche Freigabe vor jedem Schreibvorgang).

## Sicherheit

Local-first und token-geschützt. Kostenloses SAST bei jedem PR (Semgrep + Gitleaks + Trivy), dazu Dependabot und Secret-Scanning. Der Vault und das API-Token liegen außerhalb dieses Repos und werden niemals committet.

---

*Status: v0.4 – erfassen, im Dialog verfeinern, anhäufen.*
