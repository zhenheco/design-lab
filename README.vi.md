# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · **Tiếng Việt** · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Bộ nhớ gu thẩm mỹ thiết kế cá nhân, theo từng thương hiệu, dành cho Claude Code.**

Bạn xem những thiết kế mình thích, đưa ra nhận xét tinh tế ("phần chữ thì tuyệt, nhưng bảng màu quá lạnh"), và chúng tích lũy dần thành một bộ nhớ cục bộ. Khi sau này bạn yêu cầu Claude Code dựng một giao diện frontend, `/design` sẽ nạp gu thẩm mỹ đã tích lũy đó để kết quả trông giống *bạn* hơn — theo từng thương hiệu, sắc bén hơn qua mỗi vòng lặp.

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

Nó hoạt động **theo từng thương hiệu** (brand-scoped): một thương hiệu-bản-thân nền tảng (`_personal`) có gu thẩm mỹ lan tỏa vào mọi thương hiệu, cộng với các thương hiệu được đặt tên mà các case (trường hợp) của chúng không bao giờ rò rỉ chéo sang nhau.

---

## Cách hoạt động

- **Vault (Kho lưu trữ)** — nguồn chân lý duy nhất cho gu thẩm mỹ của bạn, một thư mục thuần chứa markdown + YAML mà bạn sở hữu và có thể tự `git` (được giữ bên ngoài repo này). Nó chứa **style guide** (chỉ dẫn phong cách) theo từng thương hiệu, các **case** đã thích, một **anti-library** (thư viện phản diện), và các **NEVER rule** (quy tắc cấm tuyệt đối).
- **Sidecar** — một daemon Express cục bộ nhỏ luôn chạy (`127.0.0.1:5174`), phục vụ qua HTTP một góc nhìn đã gộp và giới hạn theo truy xuất của vault (`/api/context`, `/api/distill/:brand`, …). Các endpoint đọc mở cho loopback; các thao tác ghi cần một API token cục bộ.
- **MCP server** — bọc lấy sidecar để một agent (ví dụ một agent Hermes cục bộ) có thể đọc ngữ cảnh và thu thập gu thẩm mỹ mới bằng 7 công cụ.
- **`/design`** — phía tiêu thụ trong Claude Code: nạp bộ nhớ đã gộp của thương hiệu và đóng khung nó (brand guide → tuân theo, NEVER rules → ràng buộc cứng, các case đã thích → mô phỏng, anti-case → tránh) vào prompt sinh nội dung.

### Khái niệm cốt lõi

| Thuật ngữ | Ý nghĩa |
|------|---------|
| **Brand (Thương hiệu)** | Một phạm vi gu thẩm mỹ. `_personal` = thương hiệu-bản-thân (nền tảng, lan tỏa vào tất cả). Các thương hiệu được đặt tên là dành riêng cho từng khách hàng. |
| **Case (Trường hợp)** | Một thiết kế đã được thu thập (ảnh chụp màn hình + các token được trích xuất) kèm những trích dẫn và nhận xét của bạn. |
| **Aspect (Khía cạnh)** | Một nhận xét theo từng chiều của một case — `{dimension, verdict: like\|dislike, note}`. Một thiết kế hiếm khi tốt toàn diện. |
| **Style guide (Chỉ dẫn phong cách)** | Các quy tắc markdown theo từng thương hiệu (chỉ dẫn thương hiệu-bản-thân toàn cục + các ghi đè theo từng thương hiệu). |
| **NEVER rule (Quy tắc cấm tuyệt đối)** | Một ràng buộc cứng kèm bộ phát hiện, được linter cưỡng chế trên CSS được sinh ra. |
| **Distillation (Chưng cất)** | Gom cụm các tín hiệu like/dislike đã tích lũy thành các ứng viên NEVER / ghi chú phong cách được đề xuất — **có cổng phê duyệt**, không bao giờ tự động ghi. |

---

## Vòng lặp

- **Đầu vào** — cron hằng ngày của một agent Hermes cục bộ đề xuất các ứng viên thiết kế; bạn xem xét và trả lời bằng các nhận xét theo từng khía cạnh; agent thu thập chúng vào vault thông qua các công cụ MCP.
- **Đầu ra** — trong Claude Code: `/design "<task>" <brand> <scenario>` nạp bộ nhớ đã gộp của thương hiệu và sinh ra một frontend theo gu thẩm mỹ đã tích lũy.
- **Tích lũy cộng dồn** — khi các tín hiệu dày lên, `distill_taste` gom cụm chúng thành các ứng viên quy tắc bền vững; bạn phê duyệt; quy tắc được đưa vào style guide của thương hiệu; `/design` trở nên sắc bén hơn.

[`open-design`](https://github.com/zhenheco/open-design) có thể tùy chọn tiêu thụ cùng ngữ cảnh đó như một studio sinh nội dung thứ ba (chỉ đọc) thông qua skill `design-memory-bridge`.

---

## Cài đặt

Yêu cầu: **Node ≥ 20** (sidecar dùng `better-sqlite3` 12.x; Node 26 vẫn ổn), và [Claude Code](https://claude.com/claude-code).

Chỉ một lệnh — clone và chạy trình cài đặt:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` cài đặt các phụ thuộc, build dashboard, liên kết skill vào Claude Code (`~/.claude/skills/design-lab`), khởi tạo một vault, khởi động sidecar (một daemon launchd trên macOS; được tự động sinh theo nhu cầu ở nơi khác), và in ra cách đăng ký MCP server. Nó có tính bất biến (idempotent) — an toàn để chạy lại sau khi `git pull`.

Kiểm chứng:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

Vault mặc định nằm ở `~/Documents/CC Cli/design-library`; ghi đè bằng `DESIGN_LAB_VAULT_PATH`. Để dùng công cụ chụp màn hình `capture_url`, hãy chạy thêm `npx playwright install chromium`.

### Đăng ký MCP server

Trỏ agent của bạn tới điểm vào stdio `skill/mcp/start.sh` — nó tự động khám phá toàn bộ 7 công cụ. Ví dụ:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Sinh nội dung theo gu thẩm mỹ của bạn

```bash
/design "build a landing hero" <brand> landing
```

---

## Các công cụ MCP

| Công cụ | Mục đích |
|------|---------|
| `get_context` | Đọc ngữ cảnh giới hạn theo truy xuất của thương hiệu (style guide + các case + NEVER rules). |
| `list_clients` | Liệt kê các thương hiệu. |
| `add_case` | Thu thập một case từ đường dẫn ảnh cục bộ. |
| `capture_url` | Chụp màn hình một URL, trích xuất các token thiết kế được tính toán trực tiếp, lưu thành một case. |
| `add_feedback` | Ghi lại một tín hiệu gu thẩm mỹ không gắn với một ảnh cụ thể. |
| `edit_style_guide` | Chỉnh sửa style guide toàn cục hoặc theo từng thương hiệu (được bảo vệ chống xung đột hash). |
| `distill_taste` | Gom cụm các tín hiệu like/dislike đã tích lũy thành các ứng viên quy tắc (chỉ đọc; bạn phê duyệt trước khi lưu giữ). |

Các thao tác ghi yêu cầu API token cục bộ (`X-Design-Lab-Token`, đọc theo từng request từ `~/.claude/state/design-lab/api-token`). Danh sách cho phép Host + token bảo vệ sidecar khỏi tấn công DNS-rebinding từ các trình duyệt cục bộ.

---

## Bố cục dự án

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

## Kiểm thử

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Các quyết định thiết kế

Xem [`docs/adr/`](docs/adr/):

- **0001** — giữ design-lab và open-design là hai codebase riêng biệt.
- **0002** — tích hợp với agent thông qua một MCP server bọc lấy sidecar.
- **0003** — các style guide theo từng thương hiệu được gộp vào `/api/context`.
- **0004** — phản hồi case theo khía cạnh (theo từng chiều).
- **0005** — chưng cất có cổng phê duyệt (gom cụm xác định trong sidecar, LLM soạn thảo + con người phê duyệt trước bất kỳ thao tác ghi nào).

## Bảo mật

Ưu tiên cục bộ (local-first) và được bảo vệ bằng token. SAST miễn phí trên mọi PR (Semgrep + Gitleaks + Trivy), cộng với Dependabot và quét secret. Vault và API token nằm bên ngoài repo này và không bao giờ được commit.

---

*Trạng thái: v0.4 — thu thập, đối thoại, tích lũy cộng dồn.*
