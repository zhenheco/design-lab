# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · **Bahasa Indonesia** · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Memori selera desain pribadi yang dilingkup per brand untuk Claude Code.**

Anda melihat desain yang Anda sukai, memberikan penilaian yang bernuansa ("tipografinya bagus, paletnya terlalu dingin"), dan semuanya terakumulasi menjadi memori lokal. Ketika nanti Anda meminta Claude Code membangun frontend, `/design` memuat selera yang sudah terakumulasi itu sehingga hasilnya terlihat lebih seperti *Anda* — per brand, semakin tajam di setiap siklus.

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

Sistem ini **dilingkup per brand** (brand-scoped): ada satu baseline self-brand (`_personal`) yang seleranya mengalir ke setiap brand, ditambah brand-brand bernama yang case-nya tidak pernah saling bocor.

---

## Cara kerjanya

- **Vault** — sumber kebenaran tunggal untuk selera Anda, sebuah folder biasa berisi markdown + YAML yang Anda miliki dan bisa Anda `git` sendiri (disimpan di luar repo ini). Memuat **style guide** per brand, **case** yang disukai, sebuah **anti-library**, dan **NEVER rules**.
- **Sidecar** — daemon Express lokal kecil yang selalu aktif (`127.0.0.1:5174`) yang menyajikan tampilan vault yang telah digabungkan dan dilingkup-retrieval melalui HTTP (`/api/context`, `/api/distill/:brand`, …). Endpoint baca terbuka untuk loopback; operasi tulis memerlukan token API lokal.
- **MCP server** — membungkus sidecar agar sebuah agen (misalnya agen Hermes lokal) dapat membaca konteks dan menangkap selera baru dengan 7 tool.
- **`/design`** — konsumen di sisi Claude Code: memuat memori brand yang telah digabungkan dan membingkainya (brand guide → diikuti, NEVER rules → batasan keras, case yang disukai → ditiru, anti-case → dihindari) ke dalam prompt generasi.

### Konsep inti

| Term | Makna |
|------|-------|
| **Brand** | Sebuah lingkup selera. `_personal` = self-brand (baseline, mengalir ke semua). Brand bernama bersifat spesifik per klien. |
| **Case** | Satu desain yang ditangkap (tangkapan layar + token yang diekstrak) beserta kutipan dan penilaian Anda. |
| **Aspect** | Penilaian per dimensi atas sebuah case — `{dimension, verdict: like\|dislike, note}`. Sebuah desain jarang sepenuhnya bagus. |
| **Style guide** | Aturan markdown per brand (panduan self-brand global + penimpaan per brand). |
| **NEVER rule** | Batasan keras dengan sebuah detektor, ditegakkan pada CSS yang dihasilkan oleh linter. |
| **Distillation** | Pengelompokan sinyal like/dislike yang terakumulasi menjadi usulan kandidat NEVER / catatan gaya — **dijaga persetujuan** (approval-gated), tidak pernah ditulis otomatis. |

---

## Loop-nya

- **Input** — cron harian dari agen Hermes lokal memunculkan kandidat desain; Anda meninjau dan membalas dengan penilaian per aspek; agen menangkapnya ke dalam vault melalui MCP tools.
- **Output** — di Claude Code: `/design "<task>" <brand> <scenario>` memuat memori brand yang telah digabungkan dan menghasilkan frontend sesuai selera yang terakumulasi.
- **Compound** — seiring sinyal menumpuk, `distill_taste` mengelompokkannya menjadi kandidat aturan yang tahan lama; Anda menyetujui; aturan tersebut masuk ke style guide brand; `/design` menjadi semakin tajam.

[`open-design`](https://github.com/zhenheco/open-design) secara opsional dapat mengonsumsi konteks yang sama sebagai studio generasi ketiga (hanya-baca) melalui skill `design-memory-bridge`.

---

## Instalasi

Persyaratan: **Node ≥ 20** (sidecar menggunakan `better-sqlite3` 12.x; Node 26 juga oke), dan [Claude Code](https://claude.com/claude-code).

Satu perintah — klon dan jalankan installer:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` memasang dependensi, membangun dashboard, menautkan skill ke dalam Claude Code (`~/.claude/skills/design-lab`), menginisialisasi sebuah vault, menjalankan sidecar (daemon launchd di macOS; di-spawn otomatis sesuai kebutuhan di tempat lain), dan menampilkan cara mendaftarkan MCP server. Installer bersifat idempoten — aman untuk dijalankan ulang setelah `git pull`.

Verifikasi:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

Vault secara default berada di `~/Documents/CC Cli/design-library`; timpa dengan `DESIGN_LAB_VAULT_PATH`. Untuk menggunakan tool tangkapan layar `capture_url`, jalankan juga `npx playwright install chromium`.

### Mendaftarkan MCP server

Arahkan agen Anda ke entri stdio `skill/mcp/start.sh` — ia akan menemukan ketujuh tool secara otomatis. Contohnya:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### Menghasilkan dengan selera Anda

```bash
/design "build a landing hero" <brand> landing
```

---

## MCP tools

| Tool | Tujuan |
|------|--------|
| `get_context` | Membaca konteks brand yang dilingkup-retrieval (style guide + case + NEVER rules). |
| `list_clients` | Menampilkan daftar brand. |
| `add_case` | Menangkap sebuah case dari path gambar lokal. |
| `capture_url` | Menangkap layar sebuah URL, mengekstrak token desain hasil komputasi langsung, menyimpannya sebagai sebuah case. |
| `add_feedback` | Mencatat sinyal selera yang tidak terikat pada satu gambar. |
| `edit_style_guide` | Mengedit style guide global atau per brand (terlindungi konflik hash). |
| `distill_taste` | Mengelompokkan sinyal like/dislike yang terakumulasi menjadi kandidat aturan (hanya-baca; Anda menyetujui sebelum dipersistenkan). |

Operasi tulis memerlukan token API lokal (`X-Design-Lab-Token`, dibaca per permintaan dari `~/.claude/state/design-lab/api-token`). Allowlist Host + token melindungi sidecar dari DNS-rebinding oleh browser lokal.

---

## Tata letak proyek

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

## Tes

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## Keputusan desain

Lihat [`docs/adr/`](docs/adr/):

- **0001** — menjaga design-lab dan open-design sebagai basis kode yang terpisah.
- **0002** — berintegrasi dengan agen melalui MCP server yang membungkus sidecar.
- **0003** — style guide per brand digabungkan ke dalam `/api/context`.
- **0004** — umpan balik case yang aspektual (per dimensi).
- **0005** — distillation yang dijaga persetujuan (klaster deterministik di sidecar, penyusunan draf oleh LLM + persetujuan manusia sebelum penulisan apa pun).

## Keamanan

Mengutamakan lokal (local-first) dan terlindungi token. SAST gratis pada setiap PR (Semgrep + Gitleaks + Trivy), ditambah Dependabot dan pemindaian rahasia. Vault dan token API berada di luar repo ini dan tidak pernah di-commit.

---

*Status: v0.4 — capture, converse, compound.*
