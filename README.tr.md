# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · **Türkçe** · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Claude Code için kişisel, markaya özgü bir tasarım zevki belleği.**

Beğendiğiniz tasarımları görür, nüanslı değerlendirmeler verirsiniz ("tipografi harika ama palet fazla soğuk") ve bunlar yerel bir bellekte birikir. Daha sonra Claude Code'dan bir önyüz oluşturmasını istediğinizde, `/design` bu birikmiş zevki yükler; böylece çıktı daha çok *sizin* gibi görünür — her markaya özgü olarak ve her döngüde biraz daha keskinleşerek.

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

Sistem **markaya özgüdür** (brand-scoped): her markaya akan temel bir öz-marka (`_personal`) ile, vakaları birbirine asla sızmayan adlandırılmış markalar bir arada bulunur.

---

## Nasıl çalışır

- **Vault (Kasa)** — zevkinizin tek doğruluk kaynağı; sahibi olduğunuz ve kendiniz `git` ile yönetebileceğiniz, düz bir markdown + YAML klasörü (bu deponun dışında tutulur). Marka bazında **stil kılavuzlarını** (style guides), beğenilen **vakaları** (cases), bir **anti-kütüphaneyi** (anti-library) ve **NEVER kurallarını** barındırır.
- **Sidecar (Yardımcı Süreç)** — kasanın getirme kapsamlı (retrieval-scoped) ve birleştirilmiş bir görünümünü HTTP üzerinden sunan, küçük ve her zaman çalışan yerel bir Express arka plan süreci (`127.0.0.1:5174`) (`/api/context`, `/api/distill/:brand`, …). Okuma uç noktaları loopback'e açıktır; yazma işlemleri yerel bir API jetonu gerektirir.
- **MCP server** — bir ajanın (örneğin yerel bir Hermes ajanı) 7 araçla bağlamı okumasına ve yeni zevk yakalamasına olanak tanımak için sidecar'ı sarmalar.
- **`/design`** — Claude Code tarafındaki tüketici: markanın birleştirilmiş belleğini yükler ve üretim istemine (brand guide → uy, NEVER rules → katı kısıtlar, beğenilen vakalar → taklit et, anti-vakalar → kaçın) biçiminde çerçeveler.

### Temel kavramlar

| Terim | Anlamı |
|------|---------|
| **Brand (Marka)** | Bir zevk kapsamı. `_personal` = öz-marka (temel; hepsine akar). Adlandırılmış markalar müşteriye özgüdür. |
| **Case (Vaka)** | Alıntılarınız ve değerlendirmenizle birlikte yakalanan tek bir tasarım (ekran görüntüsü + çıkarılan jetonlar). |
| **Aspect (Boyut)** | Bir vaka üzerindeki boyut bazlı değerlendirme — `{dimension, verdict: like\|dislike, note}`. Bir tasarım nadiren baştan sona iyidir. |
| **Style guide (Stil kılavuzu)** | Marka bazında markdown kuralları (genel öz-marka kılavuzu + marka bazlı geçersiz kılmalar). |
| **NEVER rule (NEVER kuralı)** | Bir dedektörü olan, linter tarafından üretilen CSS üzerinde uygulanan katı bir kısıt. |
| **Distillation (Damıtma)** | Biriken beğen/beğenme sinyallerini önerilen NEVER / stil-notu adaylarına kümeleme — **onay kapılı** (approval-gated), asla otomatik yazılmaz. |

---

## Döngü

- **Girdi** — yerel bir Hermes ajanının günlük cron işi tasarım adaylarını yüzeye çıkarır; siz inceler ve boyut bazlı değerlendirmelerle yanıt verirsiniz; ajan da bunları MCP araçları aracılığıyla kasaya yakalar.
- **Çıktı** — Claude Code içinde: `/design "<task>" <brand> <scenario>` markanın birleştirilmiş belleğini yükler ve birikmiş zevkle bir önyüz üretir.
- **Bileşik etki** — sinyaller biriktikçe, `distill_taste` bunları kalıcı kural adaylarına kümeler; siz onaylarsınız; kural markanın stil kılavuzuna işlenir; `/design` daha da keskinleşir.

[`open-design`](https://github.com/zhenheco/open-design), `design-memory-bridge` skill'i aracılığıyla aynı bağlamı üçüncü (yalnızca okunabilir) bir üretim stüdyosu olarak isteğe bağlı şekilde tüketebilir.

---

## Kurulum

Gereksinimler: **Node ≥ 20** (sidecar `better-sqlite3` 12.x kullanır; Node 26 sorunsuzdur) ve [Claude Code](https://claude.com/claude-code).

Tek komut — klonlayın ve yükleyiciyi çalıştırın:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` bağımlılıkları kurar, panoyu (dashboard) derler, skill'i Claude Code'a bağlar (`~/.claude/skills/design-lab`), bir kasa başlatır, sidecar'ı çalıştırır (macOS'te bir launchd arka plan süreci; diğer yerlerde talep üzerine otomatik başlatılır) ve MCP server'ın nasıl kaydedileceğini yazdırır. İdempotenttir — `git pull` sonrası yeniden çalıştırmak güvenlidir.

Doğrulayın:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

Kasa varsayılan olarak `~/Documents/CC Cli/design-library` konumundadır; `DESIGN_LAB_VAULT_PATH` ile geçersiz kılabilirsiniz. `capture_url` ekran görüntüsü aracını kullanmak için ayrıca `npx playwright install chromium` komutunu da çalıştırın.

### MCP server'ı kaydetme

Ajanınızı stdio giriş noktası `skill/mcp/start.sh`'ye yönlendirin — 7 aracın tümünü otomatik olarak keşfeder. Örneğin:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Kendi zevkinizle üretme

```bash
/design "build a landing hero" <brand> landing
```

---

## MCP araçları

| Araç | Amaç |
|------|---------|
| `get_context` | Markanın getirme kapsamlı bağlamını okur (stil kılavuzu + vakalar + NEVER kuralları). |
| `list_clients` | Markaları listeler. |
| `add_case` | Yerel bir görüntü yolundan bir vaka yakalar. |
| `capture_url` | Bir URL'nin ekran görüntüsünü alır, canlı hesaplanmış tasarım jetonlarını çıkarır ve bir vaka olarak kaydeder. |
| `add_feedback` | Tek bir görüntüye bağlı olmayan bir zevk sinyalini günlüğe kaydeder. |
| `edit_style_guide` | Genel veya marka bazlı stil kılavuzunu düzenler (hash-çakışmasına karşı korumalı). |
| `distill_taste` | Biriken beğen/beğenme sinyallerini kural adaylarına kümeler (yalnızca okunur; kalıcı hale getirmeden önce siz onaylarsınız). |

Yazma işlemleri yerel API jetonu gerektirir (`X-Design-Lab-Token`, her istekte `~/.claude/state/design-lab/api-token` konumundan okunur). Host izin listesi (allowlist) + jeton, sidecar'ı yerel tarayıcılardan gelen DNS-rebinding saldırılarına karşı korur.

---

## Proje düzeni

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

## Testler

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Tasarım kararları

Bkz. [`docs/adr/`](docs/adr/):

- **0001** — design-lab ve open-design'ı ayrı kod tabanları olarak tut.
- **0002** — ajanla, sidecar'ı sarmalayan bir MCP server aracılığıyla entegre ol.
- **0003** — marka bazlı stil kılavuzları `/api/context` içinde birleştirilir.
- **0004** — boyutsal (her boyut için ayrı) vaka geri bildirimi.
- **0005** — onay kapılı damıtma (sidecar'da deterministik kümeler, herhangi bir yazma işleminden önce LLM taslağı + insan onayı).

## Güvenlik

Yerel öncelikli (local-first) ve jeton korumalı. Her PR'da ücretsiz SAST (Semgrep + Gitleaks + Trivy), ayrıca Dependabot ve gizli bilgi taraması. Kasa ve API jetonu bu deponun dışında yaşar ve asla işlenmez (commit edilmez).

---

*Durum: v0.4 — yakala, sohbet et, biriktir.*
