# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · **Italiano** · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Una memoria personale del gusto progettuale, definita per brand, pensata per Claude Code.**

Vedi i design che ti piacciono, esprimi giudizi sfumati ("la tipografia è ottima, la palette è troppo fredda") e questi si accumulano in una memoria locale. Quando in seguito chiedi a Claude Code di costruire un frontend, `/design` carica quel gusto accumulato così che il risultato assomigli di più a *te* — per ogni brand, affinandosi a ogni ciclo.

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

È **definito per brand** (brand-scoped): un self-brand di base (`_personal`) il cui gusto confluisce in ogni brand, più brand con nome i cui casi (case) non si mescolano mai tra loro.

---

## Come funziona

- **Vault** — l'unica fonte di verità per il tuo gusto, una semplice cartella di markdown + YAML che possiedi e puoi versionare tu stesso con `git` (mantenuta fuori da questo repository). Contiene le **style guide** per ogni brand, i **case** che ti piacciono, una **anti-library** e le **NEVER rule**.
- **Sidecar** — un piccolo daemon Express locale sempre attivo (`127.0.0.1:5174`) che serve via HTTP una vista del vault unita e con ambito di recupero (`/api/context`, `/api/distill/:brand`, …). Gli endpoint di lettura sono aperti al loopback; le scritture richiedono un token API locale.
- **MCP server** — incapsula il sidecar in modo che un agente (per esempio un agente Hermes locale) possa leggere il contesto e catturare nuovo gusto tramite 7 strumenti.
- **`/design`** — il consumatore lato Claude Code: carica la memoria unita del brand e la inquadra (guida del brand → da seguire, NEVER rule → vincoli rigidi, case apprezzati → da emulare, anti-case → da evitare) nel prompt di generazione.

### Concetti chiave

| Termine | Significato |
|------|---------|
| **Brand** | Un ambito di gusto. `_personal` = self-brand (la base, confluisce in tutti). I brand con nome sono specifici del cliente. |
| **Case** | Un singolo design catturato (screenshot + token estratti) con le tue citazioni e il tuo giudizio. |
| **Aspect** | Un giudizio per dimensione su un case — `{dimension, verdict: like\|dislike, note}`. Un design è raramente del tutto buono. |
| **Style guide** | Regole markdown per ogni brand (guida globale del self-brand + override per ciascun brand). |
| **NEVER rule** | Un vincolo rigido dotato di un rilevatore, applicato dal linter sul CSS generato. |
| **Distillation** | Il raggruppamento dei segnali like/dislike accumulati in candidati a NEVER rule / nota di stile — **soggetto ad approvazione**, mai scritto automaticamente. |

---

## Il ciclo

- **Input** — il cron giornaliero di un agente Hermes locale fa emergere candidati di design; tu li esamini e rispondi con giudizi per ciascun aspetto; l'agente li cattura nel vault tramite gli strumenti MCP.
- **Output** — in Claude Code: `/design "<task>" <brand> <scenario>` carica la memoria unita del brand e genera un frontend nel gusto accumulato.
- **Compound** — man mano che i segnali si accumulano, `distill_taste` li raggruppa in candidati a regole durature; tu approvi; la regola entra nella style guide del brand; `/design` si affina.

[`open-design`](https://github.com/zhenheco/open-design) può facoltativamente consumare lo stesso contesto come terzo studio di generazione (in sola lettura) tramite la skill `design-memory-bridge`.

---

## Installazione

Requisiti: **Node ≥ 20** (il sidecar usa `better-sqlite3` 12.x; Node 26 va bene) e [Claude Code](https://claude.com/claude-code).

Un solo comando — clona ed esegui l'installer:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` installa le dipendenze, compila la dashboard, collega la skill a Claude Code (`~/.claude/skills/design-lab`), inizializza un vault, avvia il sidecar (un daemon launchd su macOS; avviato automaticamente su richiesta altrove) e mostra come registrare l'MCP server. È idempotente — può essere rieseguito in sicurezza dopo un `git pull`.

Verifica:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

Il vault punta per impostazione predefinita a `~/Documents/CC Cli/design-library`; puoi sovrascriverlo con `DESIGN_LAB_VAULT_PATH`. Per usare lo strumento di screenshot `capture_url`, esegui anche `npx playwright install chromium`.

### Registrare l'MCP server

Indirizza il tuo agente verso l'entry stdio `skill/mcp/start.sh` — rileva automaticamente tutti i 7 strumenti. Per esempio:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Generare con il tuo gusto

```bash
/design "build a landing hero" <brand> landing
```

---

## Strumenti MCP

| Strumento | Scopo |
|------|---------|
| `get_context` | Legge il contesto del brand con ambito di recupero (style guide + case + NEVER rule). |
| `list_clients` | Elenca i brand. |
| `add_case` | Cattura un case da un percorso di immagine locale. |
| `capture_url` | Esegue lo screenshot di un URL, estrae i token di design calcolati in tempo reale e li salva come case. |
| `add_feedback` | Registra un segnale di gusto non legato a una singola immagine. |
| `edit_style_guide` | Modifica la style guide globale o di un singolo brand (protetta dai conflitti di hash). |
| `distill_taste` | Raggruppa i segnali like/dislike accumulati in candidati a regole (in sola lettura; tu approvi prima della persistenza). |

Le scritture richiedono il token API locale (`X-Design-Lab-Token`, letto a ogni richiesta da `~/.claude/state/design-lab/api-token`). L'allowlist degli Host + il token proteggono il sidecar dal DNS-rebinding da parte dei browser locali.

---

## Struttura del progetto

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

## Test

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Decisioni di progettazione

Vedi [`docs/adr/`](docs/adr/):

- **0001** — mantenere design-lab e open-design come codebase separati.
- **0002** — integrarsi con l'agente tramite un MCP server che incapsula il sidecar.
- **0003** — style guide per ciascun brand unite in `/api/context`.
- **0004** — feedback sui case di tipo aspectual (per dimensione).
- **0005** — distillazione soggetta ad approvazione (cluster deterministici nel sidecar, bozza redatta dall'LLM + approvazione umana prima di qualsiasi scrittura).

## Sicurezza

Local-first e protetto da token. SAST gratuito su ogni PR (Semgrep + Gitleaks + Trivy), oltre a Dependabot e secret scanning. Il vault e il token API risiedono fuori da questo repository e non vengono mai committati.

---

*Stato: v0.4 — cattura, conversa, accumula.*
