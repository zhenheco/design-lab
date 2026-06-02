# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · **日本語** · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Claude Code のための、パーソナルでブランド単位のデザインセンス記憶。**

気に入ったデザインを見つけ、ニュアンスのある評価を下し（「タイポグラフィは素晴らしいが、配色が冷たすぎる」）、それらがローカルの記憶として蓄積されていきます。後で Claude Code にフロントエンドの構築を依頼すると、`/design` がその蓄積されたセンスを読み込み、出力がより *あなた* らしいものになります。ブランドごとに、サイクルを重ねるたびに精度が高まっていきます。

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

これは **ブランド単位** です。すべてのブランドにセンスが流れ込むベースラインのセルフブランド（`_personal`）と、互いに Case が決して漏れ合わない名前付きのブランドから構成されます。

---

## 仕組み

- **Vault（ボールト）** — あなたのセンスの唯一の信頼できる情報源（SSOT）であり、自分で所有し自分で `git` 管理できる、markdown と YAML のプレーンなフォルダです（このリポジトリの外に保管されます）。ブランドごとの **スタイルガイド**、気に入った **Case**、**アンチライブラリ**、そして **NEVER ルール** を保持します。
- **Sidecar（サイドカー）** — 常駐する小さなローカル Express デーモン（`127.0.0.1:5174`）で、retrieval スコープでマージされたボールトのビューを HTTP 経由で提供します（`/api/context`、`/api/distill/:brand` など）。読み取りエンドポイントはループバックに開放されていますが、書き込みにはローカル API トークンが必要です。
- **MCP server** — Sidecar をラップし、エージェント（例：ローカルの Hermes エージェント）が 7 つのツールでコンテキストを読み取り、新しいセンスを capture できるようにします。
- **`/design`** — Claude Code 側のコンシューマーです。ブランドのマージされた記憶を読み込み、それを生成プロンプトに枠付けします（ブランドガイド → 従う、NEVER ルール → 厳格な制約、気に入った Case → 模倣、アンチ Case → 回避）。

### 中核となる概念

| 用語 | 意味 |
|------|---------|
| **Brand（ブランド）** | センスのスコープ。`_personal` = セルフブランド（ベースラインで、すべてに流れ込む）。名前付きブランドはクライアント固有です。 |
| **Case（ケース）** | キャプチャされた 1 つのデザイン（スクリーンショット + 抽出されたトークン）に、あなたの引用と評価を添えたもの。 |
| **Aspect（アスペクト）** | Case に対する次元ごとの評価 — `{dimension, verdict: like\|dislike, note}`。デザインがすべて良いということは稀です。 |
| **Style guide（スタイルガイド）** | ブランドごとの markdown ルール（グローバルなセルフブランドガイド + ブランドごとのオーバーライド）。 |
| **NEVER ルール** | 検出器を備えた厳格な制約で、生成された CSS に対してリンターによって強制されます。 |
| **Distillation（蒸留）** | 蓄積された like/dislike のシグナルをクラスタリングし、NEVER / スタイルノートの候補として提案するもの — **承認ゲート付き** で、決して自動で書き込まれることはありません。 |

---

## ループ

- **インプット** — ローカルの Hermes エージェントの日次 cron がデザイン候補を提示します。あなたはそれをレビューし、アスペクトごとの評価で返信します。エージェントはそれらを MCP ツール経由でボールトに capture します。
- **アウトプット** — Claude Code 内で `/design "<task>" <brand> <scenario>` を実行すると、ブランドのマージされた記憶を読み込み、蓄積されたセンスでフロントエンドを生成します。
- **複利的効果** — シグナルが蓄積されるにつれて、`distill_taste` がそれらを永続的なルール候補へとクラスタリングします。あなたが承認すると、そのルールはブランドのスタイルガイドに反映され、`/design` の精度が高まります。

[`open-design`](https://github.com/zhenheco/open-design) は、`design-memory-bridge` スキルを介して、同じコンテキストを 3 つ目の（読み取り専用の）生成スタジオとしてオプションで利用できます。

---

## インストール

要件：**Node ≥ 20**（Sidecar は `better-sqlite3` 12.x を使用します。Node 26 でも問題ありません）、および [Claude Code](https://claude.com/claude-code)。

1 つのコマンドで — クローンしてインストーラーを実行します:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` は依存関係をインストールし、ダッシュボードをビルドし、スキルを Claude Code にリンクし（`~/.claude/skills/design-lab`）、ボールトを初期化し、Sidecar を起動し（macOS では launchd デーモン、それ以外の環境ではオンデマンドで自動起動）、MCP server の登録方法を表示します。これは冪等であり、`git pull` の後に再実行しても安全です。

確認:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

ボールトのデフォルトは `~/Documents/CC Cli/design-library` です。`DESIGN_LAB_VAULT_PATH` で上書きできます。`capture_url` のスクリーンショットツールを使用するには、`npx playwright install chromium` も実行してください。

### MCP server を登録する

エージェントを stdio エントリ `skill/mcp/start.sh` に向けると、7 つのツールがすべて自動検出されます。例えば:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### あなたのセンスで生成する

```bash
/design "build a landing hero" <brand> landing
```

---

## MCP ツール

| ツール | 目的 |
|------|---------|
| `get_context` | ブランドの retrieval スコープのコンテキスト（スタイルガイド + Case + NEVER ルール）を読み取ります。 |
| `list_clients` | ブランドを一覧表示します。 |
| `add_case` | ローカルの画像パスから Case をキャプチャします。 |
| `capture_url` | URL のスクリーンショットを撮り、ライブの算出されたデザイントークンを抽出し、Case として保存します。 |
| `add_feedback` | 1 つの画像に紐づかないセンスのシグナルを記録します。 |
| `edit_style_guide` | グローバルまたはブランドごとのスタイルガイドを編集します（ハッシュ競合から保護されます）。 |
| `distill_taste` | 蓄積された like/dislike のシグナルをルール候補へとクラスタリングします（読み取り専用。永続化の前にあなたが承認します）。 |

書き込みにはローカル API トークンが必要です（`X-Design-Lab-Token`。リクエストごとに `~/.claude/state/design-lab/api-token` から読み取られます）。Host の許可リスト + トークンが、ローカルブラウザからの DNS リバインディングに対して Sidecar を保護します。

---

## プロジェクト構成

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

## テスト

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## 設計上の決定

[`docs/adr/`](docs/adr/) を参照してください:

- **0001** — design-lab と open-design を別々のコードベースとして保つ。
- **0002** — Sidecar をラップした MCP server を介してエージェントと統合する。
- **0003** — ブランドごとのスタイルガイドを `/api/context` にマージする。
- **0004** — アスペクト的な（次元ごとの）Case フィードバック。
- **0005** — 承認ゲート付きの蒸留（Sidecar での決定論的なクラスタリング、書き込み前の LLM によるドラフト作成 + 人間による承認）。

## セキュリティ

ローカルファースト、かつトークン保護。すべての PR で無料の SAST（Semgrep + Gitleaks + Trivy）を実行し、加えて Dependabot とシークレットスキャンも実行します。ボールトと API トークンはこのリポジトリの外に存在し、決してコミットされません。

---

*ステータス: v0.4 — キャプチャし、対話し、複利で積み上げる。*
