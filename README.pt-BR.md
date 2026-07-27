# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · **Português** · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Uma memória pessoal de gosto de design, com escopo por marca, para o Claude Code.**

Você vê designs de que gosta, dá veredictos cheios de nuances ("a tipografia está ótima, mas a paleta é fria demais"), e eles se acumulam em uma memória local. Quando depois você pede ao Claude Code para construir um frontend, o `/design` carrega esse gosto acumulado para que o resultado se pareça mais com *você* — por marca, ficando mais afiado a cada ciclo.

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

Tem **escopo por marca**: uma marca-base de você mesmo (`_personal`), cujo gosto flui para todas as marcas, mais marcas nomeadas cujos casos nunca vazam de uma para a outra.

---

## Como funciona

- **Vault** — a única fonte da verdade para o seu gosto, uma pasta simples de markdown + YAML que pertence a você e que você mesmo pode versionar com `git` (mantida fora deste repositório). Guarda, por marca, os **guias de estilo** (style guides), os **casos** (cases) de que você gostou, uma **antibiblioteca** (anti-library) e as **regras NEVER** (NEVER rules).
- **Sidecar** — um pequeno daemon Express local, sempre ativo (`127.0.0.1:5174`), que serve por HTTP uma visão consolidada do vault, com escopo de recuperação (`/api/context`, `/api/distill/:brand`, …). Os endpoints de leitura ficam abertos ao loopback; as escritas exigem um token de API local.
- **MCP server** — envolve o sidecar para que um agente (por exemplo, um agente Hermes local) possa ler o contexto e capturar novo gosto com 7 ferramentas.
- **`/design`** — o consumidor no Claude Code: carrega a memória consolidada da marca e a enquadra (guia da marca → seguir, regras NEVER → restrições rígidas, casos de que gostou → emular, anticasos → evitar) dentro do prompt de geração.

### Conceitos principais

| Termo | Significado |
|------|---------|
| **Brand** (marca) | Um escopo de gosto. `_personal` = marca de você mesmo (a base, que flui para todas). Marcas nomeadas são específicas de cada cliente. |
| **Case** (caso) | Um design capturado (captura de tela + tokens extraídos) com as suas citações e o seu veredicto. |
| **Aspect** (aspecto) | Um veredicto por dimensão sobre um caso — `{dimension, verdict: like\|dislike, note}`. Raramente um design é bom em tudo. |
| **Style guide** (guia de estilo) | Regras em markdown por marca (guia global da marca de você mesmo + sobreposições por marca). |
| **NEVER rule** (regra NEVER) | Uma restrição rígida com um detector, aplicada ao CSS gerado pelo linter. |
| **Distillation** (destilação) | Agrupamento dos sinais acumulados de like/dislike em candidatos a NEVER / notas de estilo propostas — **condicionado a aprovação**, nunca escrito automaticamente. |

---

## O ciclo

- **Entrada** — o cron diário de um agente Hermes local apresenta candidatos a design; você os revisa e responde com veredictos por aspecto; ele os captura no vault por meio das ferramentas MCP.
- **Saída** — no Claude Code: `/design "<task>" <brand> <scenario>` carrega a memória consolidada da marca e gera um frontend no gosto acumulado.
- **Composição** — à medida que os sinais se acumulam, o `distill_taste` os agrupa em candidatos a regras duradouras; você aprova; a regra entra no guia de estilo da marca; o `/design` fica mais afiado.

O [`open-design`](https://github.com/zhenheco/open-design) pode, opcionalmente, consumir o mesmo contexto como um terceiro estúdio de geração (somente leitura) por meio da skill `design-memory-bridge`.

---

## Instalação

Requisitos: **Node ≥ 20** (o sidecar usa o `better-sqlite3` 12.x; o Node 26 funciona bem) e o [Claude Code](https://claude.com/claude-code).

Um único comando — clone e rode o instalador:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

O `install.sh` instala as dependências, compila o dashboard, vincula a skill ao Claude Code (`~/.claude/skills/design-lab`), inicializa um vault, inicia o sidecar (um daemon launchd no macOS; iniciado sob demanda nos demais sistemas) e mostra como registrar o MCP server. Ele é idempotente — pode ser executado novamente com segurança após um `git pull`.

Verifique:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

O vault tem como padrão `~/Documents/CC Cli/design-library`; sobrescreva com `DESIGN_LAB_VAULT_PATH`. Para usar a ferramenta de captura de tela `capture_url`, rode também `npx playwright install chromium`.

### Registrar o MCP server

Aponte o seu agente para o ponto de entrada stdio `skill/mcp/start.sh` — ele descobre automaticamente todas as 7 ferramentas. Por exemplo:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Gerar com o seu gosto

```bash
/design "build a landing hero" <brand> landing
```

---

## Ferramentas MCP

| Ferramenta | Finalidade |
|------|---------|
| `get_context` | Lê o contexto da marca com escopo de recuperação (guia de estilo + casos + regras NEVER). |
| `list_clients` | Lista as marcas. |
| `add_case` | Captura um caso a partir do caminho de uma imagem local. |
| `capture_url` | Faz a captura de tela de uma URL, extrai os tokens de design computados ao vivo e salva como um caso. |
| `add_feedback` | Registra um sinal de gosto não vinculado a uma imagem. |
| `edit_style_guide` | Edita o guia de estilo global ou por marca (protegido contra conflitos de hash). |
| `distill_taste` | Agrupa os sinais acumulados de like/dislike em candidatos a regras (somente leitura; você aprova antes de persistir). |

As escritas exigem o token de API local (`X-Design-Lab-Token`, lido a cada requisição em `~/.claude/state/design-lab/api-token`). A allowlist de Host + o token protegem o sidecar contra DNS-rebinding a partir de navegadores locais.

---

## Estrutura do projeto

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

## Testes

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Decisões de design

Consulte [`docs/adr/`](docs/adr/):

- **0001** — manter o design-lab e o open-design como bases de código separadas.
- **0002** — integrar com o agente por meio de um MCP server que envolve o sidecar.
- **0003** — guias de estilo por marca, consolidados em `/api/context`.
- **0004** — feedback de casos por aspecto (por dimensão).
- **0005** — destilação condicionada a aprovação (agrupamentos determinísticos no sidecar, redação por LLM + aprovação humana antes de qualquer escrita).

## Segurança

Local em primeiro lugar (local-first) e protegido por token. SAST gratuito em cada PR (Semgrep + Gitleaks + Trivy), além de Dependabot e varredura de segredos. O vault e o token de API ficam fora deste repositório e nunca são versionados.

---

*Status: v0.4 — capture, converse, compound.*
