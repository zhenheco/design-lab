# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · **ไทย** · [Polski](README.pl.md)</samp>

**หน่วยความจำรสนิยมการออกแบบส่วนบุคคลที่จำกัดขอบเขตตามแบรนด์ สำหรับ Claude Code**

คุณเห็นงานออกแบบที่คุณชอบ ให้คำตัดสินอย่างละเอียดอ่อน ("ตัวอักษรเยี่ยมมาก แต่ชุดสีเย็นเกินไป") แล้วสิ่งเหล่านั้นก็สะสมกลายเป็นหน่วยความจำในเครื่อง เมื่อคุณขอให้ Claude Code สร้างฟรอนต์เอนด์ในภายหลัง `/design` จะโหลดรสนิยมที่สะสมไว้นั้น เพื่อให้ผลลัพธ์ดูเหมือน *ตัวคุณ* มากขึ้น โดยแยกตามแบรนด์ และคมชัดขึ้นในทุก ๆ รอบ

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

ระบบนี้ **จำกัดขอบเขตตามแบรนด์ (brand-scoped)** มีแบรนด์ตัวเองที่เป็นพื้นฐาน (`_personal`) ซึ่งรสนิยมจะไหลเข้าสู่ทุกแบรนด์ และมีแบรนด์ที่ตั้งชื่อไว้ซึ่ง case ต่าง ๆ จะไม่รั่วไหลข้ามกัน

---

## หลักการทำงาน

- **Vault (คลังข้อมูล)** — แหล่งความจริงหนึ่งเดียวสำหรับรสนิยมของคุณ เป็นโฟลเดอร์ธรรมดาที่บรรจุไฟล์ markdown + YAML ซึ่งคุณเป็นเจ้าของและสามารถนำไป `git` เองได้ (เก็บไว้นอก repo นี้) ภายในมี **style guide** แยกตามแบรนด์ **case** ที่ชื่นชอบ คลังต่อต้าน (anti-library) และ **NEVER rule** ต่าง ๆ
- **Sidecar** — เดมอน Express ในเครื่องขนาดเล็กที่ทำงานตลอดเวลา (`127.0.0.1:5174`) ทำหน้าที่ให้บริการมุมมองรวม (merged view) ของ vault ที่จำกัดขอบเขตการดึงข้อมูล (retrieval-scoped) ผ่าน HTTP (`/api/context`, `/api/distill/:brand`, …) จุดเชื่อมต่อสำหรับอ่านเปิดให้ loopback เข้าถึงได้ ส่วนการเขียนต้องใช้ API token ในเครื่อง
- **MCP server** — ห่อหุ้ม sidecar ไว้ เพื่อให้เอเจนต์ (เช่น เอเจนต์ Hermes ในเครื่อง) สามารถอ่าน context และเก็บรสนิยมใหม่ ๆ ได้ด้วยเครื่องมือ 7 ตัว
- **`/design`** — ฝั่งผู้บริโภคใน Claude Code โหลดหน่วยความจำรวมของแบรนด์ แล้วจัดกรอบให้ (brand guide → ปฏิบัติตาม, NEVER rules → ข้อจำกัดที่เด็ดขาด, liked cases → เลียนแบบ, anti-cases → หลีกเลี่ยง) ใส่เข้าไปในพรอมป์ต์สำหรับการสร้างงาน

### แนวคิดหลัก

| คำศัพท์ | ความหมาย |
|------|---------|
| **Brand (แบรนด์)** | ขอบเขตของรสนิยม `_personal` = แบรนด์ตัวเอง (พื้นฐาน ไหลเข้าสู่ทุกแบรนด์) ส่วนแบรนด์ที่ตั้งชื่อไว้จะเจาะจงเฉพาะลูกค้า |
| **Case** | งานออกแบบหนึ่งชิ้นที่เก็บไว้ (ภาพหน้าจอ + token ที่สกัดออกมา) พร้อมคำพูดอ้างอิงและคำตัดสินของคุณ |
| **Aspect (แง่มุม)** | คำตัดสินรายมิติของ case หนึ่ง ๆ — `{dimension, verdict: like\|dislike, note}` งานออกแบบหนึ่งชิ้นมักไม่ได้ดีไปทั้งหมด |
| **Style guide** | กฎ markdown แยกตามแบรนด์ (ไกด์ของแบรนด์ตัวเองในระดับสากล + การปรับแต่งเฉพาะแบรนด์) |
| **NEVER rule** | ข้อจำกัดเด็ดขาดที่มาพร้อมตัวตรวจจับ บังคับใช้กับ CSS ที่สร้างขึ้นโดย linter |
| **Distillation (การกลั่นกรอง)** | การจัดกลุ่มสัญญาณ like/dislike ที่สะสมไว้ ให้กลายเป็นข้อเสนอผู้เข้าชิงสำหรับ NEVER / style-note — **ต้องผ่านการอนุมัติ** ไม่มีการเขียนอัตโนมัติ |

---

## วงจรการทำงาน

- **Input (ขาเข้า)** — cron รายวันของเอเจนต์ Hermes ในเครื่องจะนำเสนอผู้เข้าชิงงานออกแบบ คุณตรวจดูและตอบกลับด้วยคำตัดสินรายแง่มุม จากนั้นเอเจนต์จะเก็บมันเข้า vault ผ่านเครื่องมือ MCP
- **Output (ขาออก)** — ใน Claude Code: `/design "<task>" <brand> <scenario>` จะโหลดหน่วยความจำรวมของแบรนด์ แล้วสร้างฟรอนต์เอนด์ตามรสนิยมที่สะสมไว้
- **Compound (สะสมทบต้น)** — เมื่อสัญญาณก่อตัวขึ้นเรื่อย ๆ `distill_taste` จะจัดกลุ่มมันให้กลายเป็นผู้เข้าชิงของกฎที่ยั่งยืน คุณอนุมัติ กฎก็จะลงไปอยู่ใน style guide ของแบรนด์ และ `/design` ก็จะคมชัดยิ่งขึ้น

[`open-design`](https://github.com/zhenheco/open-design) สามารถเลือกใช้ context ชุดเดียวกันนี้ในฐานะสตูดิโอสร้างงานตัวที่สาม (อ่านได้อย่างเดียว) ผ่านสกิล `design-memory-bridge` ได้

---

## การติดตั้ง

ความต้องการ: **Node ≥ 20** (sidecar ใช้ `better-sqlite3` เวอร์ชัน 12.x; Node 26 ก็ใช้ได้) และ [Claude Code](https://claude.com/claude-code)

คำสั่งเดียว — โคลนแล้วรันตัวติดตั้ง:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` จะติดตั้ง dependency, สร้าง dashboard, เชื่อมสกิลเข้ากับ Claude Code (`~/.claude/skills/design-lab`), เริ่มต้น vault, สตาร์ต sidecar (เป็นเดมอน launchd บน macOS; ระบบอื่นจะ auto-spawn ตามต้องการ) และพิมพ์วิธีลงทะเบียน MCP server ออกมา คำสั่งนี้เป็น idempotent — รันซ้ำได้อย่างปลอดภัยหลัง `git pull`

ตรวจสอบ:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

ค่าเริ่มต้นของ vault คือ `~/Documents/CC Cli/design-library`; แทนที่ด้วย `DESIGN_LAB_VAULT_PATH` ได้ หากต้องการใช้เครื่องมือถ่ายภาพหน้าจอ `capture_url` ให้รัน `npx playwright install chromium` เพิ่มด้วย

### ลงทะเบียน MCP server

ชี้เอเจนต์ของคุณไปยังจุดเข้า stdio ที่ `skill/mcp/start.sh` — มันจะค้นพบเครื่องมือทั้ง 7 ตัวโดยอัตโนมัติ ตัวอย่างเช่น:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### สร้างงานด้วยรสนิยมของคุณ

```bash
/design "build a landing hero" <brand> landing
```

---

## เครื่องมือ MCP

| เครื่องมือ | วัตถุประสงค์ |
|------|---------|
| `get_context` | อ่าน context ของแบรนด์ที่จำกัดขอบเขตการดึงข้อมูล (style guide + cases + NEVER rules) |
| `list_clients` | แสดงรายชื่อแบรนด์ |
| `add_case` | เก็บ case จากพาธของรูปภาพในเครื่อง |
| `capture_url` | ถ่ายภาพหน้าจอของ URL สกัด design token ที่คำนวณสด ๆ แล้วบันทึกเป็น case |
| `add_feedback` | บันทึกสัญญาณรสนิยมที่ไม่ผูกกับรูปภาพใดรูปหนึ่ง |
| `edit_style_guide` | แก้ไข style guide ระดับสากลหรือเฉพาะแบรนด์ (มีการป้องกันความขัดแย้งของแฮช) |
| `distill_taste` | จัดกลุ่มสัญญาณ like/dislike ที่สะสมไว้ให้กลายเป็นผู้เข้าชิงของกฎ (อ่านได้อย่างเดียว; คุณต้องอนุมัติก่อนที่จะบันทึกถาวร) |

การเขียนต้องใช้ API token ในเครื่อง (`X-Design-Lab-Token` ซึ่งอ่านในแต่ละคำขอจาก `~/.claude/state/design-lab/api-token`) การอนุญาตเฉพาะ Host (Host allowlist) + token จะปกป้อง sidecar จากการโจมตีแบบ DNS-rebinding ของเบราว์เซอร์ในเครื่อง

---

## โครงสร้างโปรเจกต์

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

## การทดสอบ

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## การตัดสินใจด้านการออกแบบ

ดูที่ [`docs/adr/`](docs/adr/):

- **0001** — แยก design-lab และ open-design ให้เป็นคนละ codebase
- **0002** — ผสานรวมกับเอเจนต์ผ่าน MCP server ที่ห่อหุ้ม sidecar
- **0003** — style guide แยกตามแบรนด์ ที่ถูกรวมเข้าไปใน `/api/context`
- **0004** — feedback ของ case แบบรายแง่มุม (รายมิติ)
- **0005** — การกลั่นกรองที่ต้องผ่านการอนุมัติ (การจัดกลุ่มแบบ deterministic ใน sidecar, LLM ร่างขึ้น + มนุษย์อนุมัติก่อนการเขียนใด ๆ)

## ความปลอดภัย

เน้นทำงานในเครื่องเป็นหลักและป้องกันด้วย token มี SAST แบบฟรีในทุก PR (Semgrep + Gitleaks + Trivy) พร้อมทั้ง Dependabot และการสแกนหา secret ทั้ง vault และ API token อยู่นอก repo นี้ และไม่เคยถูก commit เข้าไป

---

*สถานะ: v0.4 — capture, converse, compound*
