# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Español** · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Una memoria personal del gusto de diseño, acotada por marca, para Claude Code.**

Ves diseños que te gustan, das veredictos con matices ("la tipografía es genial, la paleta es demasiado fría") y se van acumulando en una memoria local. Cuando más adelante le pides a Claude Code que construya un frontend, `/design` carga ese gusto acumulado para que el resultado se parezca más a *ti* — por marca, y afinándose en cada ciclo.

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

Está **acotado por marca** (brand-scoped): una marca propia de base (`_personal`) cuyo gusto fluye hacia todas las marcas, más marcas con nombre cuyos casos nunca se filtran entre sí.

---

## Cómo funciona

- **Vault (bóveda)** — la única fuente de verdad de tu gusto, una simple carpeta de markdown + YAML que te pertenece y que tú mismo puedes versionar con `git` (se mantiene fuera de este repositorio). Contiene las **style guides** (guías de estilo) por marca, los **cases** (casos) que te gustan, una **anti-library** (anti-biblioteca) y las **NEVER rules** (reglas NEVER).
- **Sidecar** — un pequeño daemon local de Express siempre activo (`127.0.0.1:5174`) que sirve por HTTP una vista combinada y acotada por recuperación de la bóveda (`/api/context`, `/api/distill/:brand`, …). Los endpoints de lectura están abiertos a loopback; las escrituras requieren un token de API local.
- **MCP server** — envuelve al sidecar para que un agente (por ejemplo, un agente local de Hermes) pueda leer el contexto y capturar nuevo gusto con 7 herramientas.
- **`/design`** — el consumidor en Claude Code: carga la memoria combinada de la marca y la enmarca (guía de marca → seguir, NEVER rules → restricciones estrictas, casos que gustaron → emular, anti-casos → evitar) dentro del prompt de generación.

### Conceptos centrales

| Término | Significado |
|------|---------|
| **Brand** (marca) | Un ámbito de gusto. `_personal` = marca propia (la base, fluye hacia todas). Las marcas con nombre son específicas de cada cliente. |
| **Case** (caso) | Un diseño capturado (captura de pantalla + tokens extraídos) con tus citas y tu veredicto. |
| **Aspect** (aspecto) | Un veredicto por dimensión sobre un caso — `{dimension, verdict: like\|dislike, note}`. Rara vez un diseño es todo bueno. |
| **Style guide** (guía de estilo) | Reglas en markdown por marca (guía global de la marca propia + ajustes por marca). |
| **NEVER rule** (regla NEVER) | Una restricción estricta con un detector, aplicada al CSS generado por el linter. |
| **Distillation** (destilación) | Agrupar las señales acumuladas de gusto/disgusto en candidatos propuestos de NEVER / notas de estilo — **sujeto a aprobación**, nunca se escribe automáticamente. |

---

## El bucle

- **Entrada** — el cron diario de un agente local de Hermes saca a la superficie candidatos de diseño; tú los revisas y respondes con veredictos por aspecto; el agente los captura en la bóveda mediante las herramientas MCP.
- **Salida** — en Claude Code: `/design "<task>" <brand> <scenario>` carga la memoria combinada de la marca y genera un frontend con el gusto acumulado.
- **Efecto compuesto** — a medida que se acumulan las señales, `distill_taste` las agrupa en candidatos de reglas duraderas; tú las apruebas; la regla aterriza en la guía de estilo de la marca; y `/design` se afina.

[`open-design`](https://github.com/zhenheco/open-design) puede, opcionalmente, consumir el mismo contexto como un tercer estudio de generación (de solo lectura) a través de la skill `design-memory-bridge`.

---

## Instalación

Requisitos: **Node ≥ 20** (el sidecar usa `better-sqlite3` 12.x; Node 26 funciona bien) y [Claude Code](https://claude.com/claude-code).

Un solo comando — clona y ejecuta el instalador:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` instala las dependencias, construye el dashboard, enlaza la skill dentro de Claude Code (`~/.claude/skills/design-lab`), inicializa una bóveda, arranca el sidecar (un daemon launchd en macOS; generado automáticamente bajo demanda en otros sistemas) e imprime cómo registrar el MCP server. Es idempotente — se puede volver a ejecutar sin problemas tras un `git pull`.

Verifica:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

La bóveda usa por defecto `~/Documents/CC Cli/design-library`; puedes anularla con `DESIGN_LAB_VAULT_PATH`. Para usar la herramienta de captura de pantalla `capture_url`, ejecuta también `npx playwright install chromium`.

### Registrar el MCP server

Apunta tu agente a la entrada stdio `skill/mcp/start.sh` — descubre automáticamente las 7 herramientas. Por ejemplo:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Generar con tu gusto

```bash
/design "build a landing hero" <brand> landing
```

---

## Herramientas MCP

| Herramienta | Propósito |
|------|---------|
| `get_context` | Lee el contexto de la marca acotado por recuperación (style guide + casos + NEVER rules). |
| `list_clients` | Lista las marcas. |
| `add_case` | Captura un caso a partir de la ruta de una imagen local. |
| `capture_url` | Captura la pantalla de una URL, extrae los tokens de diseño calculados en vivo y lo guarda como un caso. |
| `add_feedback` | Registra una señal de gusto que no está ligada a una sola imagen. |
| `edit_style_guide` | Edita la style guide global o por marca (protegida ante conflictos de hash). |
| `distill_taste` | Agrupa las señales acumuladas de gusto/disgusto en candidatos de reglas (solo lectura; tú apruebas antes de persistir). |

Las escrituras requieren el token de API local (`X-Design-Lab-Token`, leído por petición desde `~/.claude/state/design-lab/api-token`). La allowlist de Host + el token protegen al sidecar frente al DNS-rebinding desde navegadores locales.

---

## Estructura del proyecto

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

## Pruebas

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Decisiones de diseño

Consulta [`docs/adr/`](docs/adr/):

- **0001** — mantener design-lab y open-design como bases de código separadas.
- **0002** — integrar con el agente mediante un MCP server que envuelve al sidecar.
- **0003** — guías de estilo por marca combinadas en `/api/context`.
- **0004** — feedback de casos por aspecto (por dimensión).
- **0005** — destilación sujeta a aprobación (clústeres deterministas en el sidecar, redacción con LLM + aprobación humana antes de cualquier escritura).

## Seguridad

Local-first y protegido por token. SAST gratuito en cada PR (Semgrep + Gitleaks + Trivy), además de Dependabot y escaneo de secretos. La bóveda y el token de API viven fuera de este repositorio y nunca se incluyen en commits.

---

*Estado: v0.4 — captura, conversa, compón.*
