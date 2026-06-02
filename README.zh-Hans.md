# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · **简体中文** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**一套为 Claude Code 打造的、个人化且按品牌划分的设计品味记忆系统。**

你看到自己喜欢的设计，给出细致入微的评价（“排版很棒，但配色太冷了”），这些评价会不断累积成一份本地记忆。之后当你让 Claude Code 构建前端时，`/design` 会加载这份累积下来的品味，让产出更像*你*的风格——按品牌区分，且每一轮都会变得更精准。

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

它是**按品牌划分**的：有一个作为基线的自我品牌（`_personal`），其品味会流入每一个品牌；此外还有各个具名品牌，它们的案例彼此之间绝不串味。

---

## 工作原理

- **Vault（资料库）** —— 你设计品味的唯一真实来源（single source of truth），一个由 markdown + YAML 组成的纯文件夹，归你所有，你可以自己用 `git` 管理（独立保存在本仓库之外）。它存放各品牌的**风格指南（style guide）**、喜欢的**案例（case）**、一个**反面案例库（anti-library）**，以及 **NEVER 规则（NEVER rule）**。
- **Sidecar（边车）** —— 一个常驻运行的轻量本地 Express 守护进程（`127.0.0.1:5174`），通过 HTTP（`/api/context`、`/api/distill/:brand` 等）提供一份经过检索范围筛选、合并后的资料库视图。读取端点对本地回环（loopback）开放；写入则需要本地 API 令牌。
- **MCP server** —— 它封装了 sidecar，使智能体（例如一个本地 Hermes agent）能够通过 7 个工具读取上下文并捕获新的品味。
- **`/design`** —— Claude Code 端的消费者：它加载品牌的合并记忆，并将其组织进生成 prompt（品牌指南 → 遵循，NEVER 规则 → 硬性约束，喜欢的案例 → 模仿，反面案例 → 规避）。

### 核心概念

| 术语 | 含义 |
|------|------|
| **Brand（品牌）** | 一个品味范围。`_personal` = 自我品牌（基线，流入所有品牌）。具名品牌则是客户专属的。 |
| **Case（案例）** | 一份被捕获的设计（截图 + 提取出的 token），附带你的原话引用与评价。 |
| **Aspect（维度）** | 针对某个案例、按单一维度给出的评价 —— `{dimension, verdict: like\|dislike, note}`。一个设计很少是处处都好的。 |
| **Style guide（风格指南）** | 各品牌的 markdown 规则（全局自我品牌指南 + 各品牌的覆盖规则）。 |
| **NEVER rule（NEVER 规则）** | 一条带有检测器的硬性约束，由 linter 在生成的 CSS 上强制执行。 |
| **Distillation（提炼）** | 将累积的喜欢/不喜欢信号聚类，形成候选的 NEVER / 风格备注 —— **需经审批方可生效**，绝不自动写入。 |

---

## 这套循环

- **输入** —— 一个本地 Hermes agent 的每日定时任务会浮现出一批设计候选；你逐一审阅，并按维度回复评价；它再通过 MCP 工具将这些评价捕获进资料库。
- **输出** —— 在 Claude Code 中：`/design "<task>" <brand> <scenario>` 加载该品牌的合并记忆，并以这份累积品味生成前端。
- **复利累积** —— 随着信号不断积累，`distill_taste` 会把它们聚类成持久的候选规则；你审批通过；规则落入该品牌的风格指南；`/design` 因此变得更精准。

[`open-design`](https://github.com/zhenheco/open-design) 可选地通过 `design-memory-bridge` skill 消费同一份上下文，作为第三个（只读的）生成工作室。

---

## 安装

环境要求：**Node ≥ 20**（sidecar 使用 `better-sqlite3` 12.x；Node 26 也没问题），以及 [Claude Code](https://claude.com/claude-code)。

一条命令搞定 —— 克隆仓库并运行安装脚本：

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` 会安装依赖、构建 dashboard、把 skill 链接进 Claude Code（`~/.claude/skills/design-lab`）、初始化一个资料库、启动 sidecar（在 macOS 上是一个 launchd 守护进程；在其他平台上则按需自动启动），并打印出如何注册 MCP server。它是幂等的 —— 在 `git pull` 之后重新运行也是安全的。

验证：

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

资料库默认位于 `~/Documents/CC Cli/design-library`；可用 `DESIGN_LAB_VAULT_PATH` 覆盖。若要使用 `capture_url` 截图工具，还需运行 `npx playwright install chromium`。

### 注册 MCP server

让你的智能体指向 stdio 入口 `skill/mcp/start.sh` —— 它会自动发现全部 7 个工具。例如：

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### 用你的品味来生成

```bash
/design "build a landing hero" <brand> landing
```

---

## MCP 工具

| 工具 | 用途 |
|------|------|
| `get_context` | 读取该品牌经检索范围筛选的上下文（风格指南 + 案例 + NEVER 规则）。 |
| `list_clients` | 列出所有品牌。 |
| `add_case` | 从本地图片路径捕获一个案例。 |
| `capture_url` | 对某个 URL 截图，提取实时计算出的设计 token，并保存为一个案例。 |
| `add_feedback` | 记录一条不绑定于具体图片的品味信号。 |
| `edit_style_guide` | 编辑全局或某个品牌的风格指南（带哈希冲突保护）。 |
| `distill_taste` | 将累积的喜欢/不喜欢信号聚类成候选规则（只读；在持久化之前需经你审批）。 |

写入操作需要本地 API 令牌（`X-Design-Lab-Token`，每次请求从 `~/.claude/state/design-lab/api-token` 读取）。Host 允许名单 + 令牌共同保护 sidecar，防止来自本地浏览器的 DNS 重绑定攻击。

---

## 项目结构

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

## 测试

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## 设计决策

参见 [`docs/adr/`](docs/adr/)：

- **0001** —— 将 design-lab 与 open-design 保持为两个独立的代码库。
- **0002** —— 通过一个封装了 sidecar 的 MCP server 来与智能体集成。
- **0003** —— 将各品牌的风格指南合并进 `/api/context`。
- **0004** —— 按维度（aspectual）的案例反馈。
- **0005** —— 需经审批的提炼（sidecar 中进行确定性聚类，由 LLM 起草、并在任何写入之前经人工审批）。

## 安全

本地优先（local-first）且受令牌保护。每个 PR 都会运行免费的 SAST（Semgrep + Gitleaks + Trivy），外加 Dependabot 与密钥扫描。资料库与 API 令牌都存放在本仓库之外，绝不提交。

---

*状态：v0.4 —— 捕获、对话、复利累积。*
