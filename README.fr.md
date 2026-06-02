# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · **Français** · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Une mémoire personnelle de goût en design, cloisonnée par marque, pour Claude Code.**

Vous découvrez des designs qui vous plaisent, vous formulez des verdicts nuancés (« la typographie est superbe, mais la palette est trop froide »), et ceux-ci s'accumulent dans une mémoire locale. Lorsque vous demandez ensuite à Claude Code de construire un frontend, `/design` charge ce goût accumulé pour que le résultat vous ressemble davantage — par marque, en gagnant en précision à chaque cycle.

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

Le système est **cloisonné par marque** : une marque personnelle de référence (`_personal`) dont le goût se diffuse dans toutes les autres, plus des marques nommées dont les cas (Cases) ne se mélangent jamais entre elles.

---

## Comment ça marche

- **Vault (coffre)** — la source unique de vérité pour votre goût, un simple dossier de markdown + YAML qui vous appartient et que vous pouvez versionner vous-même avec `git` (conservé en dehors de ce dépôt). Il contient les **guides de style** par marque, les **cas** appréciés, une **anti-bibliothèque** et les **règles NEVER**.
- **Sidecar** — un petit démon Express local, toujours actif (`127.0.0.1:5174`), qui sert via HTTP une vue fusionnée et filtrée par récupération du coffre (`/api/context`, `/api/distill/:brand`, …). Les points de terminaison en lecture sont ouverts en loopback ; les écritures requièrent un jeton d'API local.
- **MCP server** — enveloppe le sidecar pour qu'un agent (par exemple un agent Hermes local) puisse lire le contexte et capturer un nouveau goût grâce à 7 outils.
- **`/design`** — le consommateur côté Claude Code : il charge la mémoire fusionnée de la marque et la met en forme (guide de marque → à suivre, règles NEVER → contraintes strictes, cas appréciés → à imiter, anti-cas → à éviter) dans le prompt de génération.

### Concepts fondamentaux

| Terme | Signification |
|------|---------|
| **Brand (marque)** | Un périmètre de goût. `_personal` = marque personnelle (référence, se diffuse dans toutes les autres). Les marques nommées sont propres à un client. |
| **Case (cas)** | Un design capturé (capture d'écran + tokens extraits) accompagné de vos citations et de votre verdict. |
| **Aspect** | Un verdict par dimension sur un cas — `{dimension, verdict: like\|dislike, note}`. Un design est rarement entièrement réussi. |
| **Style guide (guide de style)** | Des règles en markdown par marque (guide global de la marque personnelle + surcharges par marque). |
| **NEVER rule (règle NEVER)** | Une contrainte stricte assortie d'un détecteur, appliquée au CSS généré par le linter. |
| **Distillation** | Le regroupement des signaux like/dislike accumulés en candidats de règles NEVER ou de notes de style — **soumis à approbation**, jamais écrit automatiquement. |

---

## La boucle

- **Entrée** — le cron quotidien d'un agent Hermes local fait remonter des candidats de design ; vous les passez en revue et répondez avec des verdicts par aspect ; il les capture dans le coffre via les outils MCP.
- **Sortie** — dans Claude Code : `/design "<task>" <brand> <scenario>` charge la mémoire fusionnée de la marque et génère un frontend dans le goût accumulé.
- **Effet cumulatif** — à mesure que les signaux s'accumulent, `distill_taste` les regroupe en candidats de règles durables ; vous approuvez ; la règle rejoint le guide de style de la marque ; `/design` gagne en précision.

[`open-design`](https://github.com/zhenheco/open-design) peut, en option, consommer le même contexte en tant que troisième studio de génération (en lecture seule) via la skill `design-memory-bridge`.

---

## Installation

Prérequis : **Node ≥ 20** (le sidecar utilise `better-sqlite3` 12.x ; Node 26 convient), et [Claude Code](https://claude.com/claude-code).

Une seule commande — clonez et lancez l'installateur :

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` installe les dépendances, construit le tableau de bord, lie la skill à Claude Code (`~/.claude/skills/design-lab`), initialise un coffre, démarre le sidecar (un démon launchd sous macOS ; lancé automatiquement à la demande ailleurs) et affiche la marche à suivre pour enregistrer le MCP server. La commande est idempotente — vous pouvez la relancer sans risque après un `git pull`.

Vérification :

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

Le coffre se trouve par défaut dans `~/Documents/CC Cli/design-library` ; remplacez ce chemin avec `DESIGN_LAB_VAULT_PATH`. Pour utiliser l'outil de capture d'écran `capture_url`, lancez également `npx playwright install chromium`.

### Enregistrer le MCP server

Pointez votre agent vers le point d'entrée stdio `skill/mcp/start.sh` — il découvre automatiquement les 7 outils. Par exemple :

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Générer avec votre goût

```bash
/design "build a landing hero" <brand> landing
```

---

## Outils MCP

| Outil | Rôle |
|------|---------|
| `get_context` | Lit le contexte de la marque filtré par récupération (guide de style + cas + règles NEVER). |
| `list_clients` | Liste les marques. |
| `add_case` | Capture un cas à partir d'un chemin d'image local. |
| `capture_url` | Effectue une capture d'écran d'une URL, extrait les tokens de design calculés en direct et l'enregistre comme cas. |
| `add_feedback` | Consigne un signal de goût non lié à une image précise. |
| `edit_style_guide` | Modifie le guide de style global ou propre à une marque (protégé contre les conflits de hash). |
| `distill_taste` | Regroupe les signaux like/dislike accumulés en candidats de règles (lecture seule ; vous approuvez avant toute persistance). |

Les écritures requièrent le jeton d'API local (`X-Design-Lab-Token`, lu à chaque requête depuis `~/.claude/state/design-lab/api-token`). La liste d'autorisation des hôtes (Host allowlist) et le jeton protègent le sidecar contre le DNS-rebinding émis par les navigateurs locaux.

---

## Organisation du projet

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

## Décisions de conception

Voir [`docs/adr/`](docs/adr/) :

- **0001** — conserver design-lab et open-design comme deux bases de code distinctes.
- **0002** — s'intégrer à l'agent via un MCP server enveloppant le sidecar.
- **0003** — des guides de style par marque fusionnés dans `/api/context`.
- **0004** — un retour par cas aspectuel (par dimension).
- **0005** — une distillation soumise à approbation (regroupements déterministes dans le sidecar, rédaction par le LLM + approbation humaine avant toute écriture).

## Sécurité

Local d'abord et protégé par jeton. SAST gratuit sur chaque PR (Semgrep + Gitleaks + Trivy), auxquels s'ajoutent Dependabot et l'analyse de secrets. Le coffre et le jeton d'API résident en dehors de ce dépôt et ne sont jamais committés.

---

*Statut : v0.4 — capturer, converser, cumuler.*
