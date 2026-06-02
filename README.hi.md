# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · **हिन्दी** · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**Claude Code के लिए एक व्यक्तिगत, ब्रांड-स्कोप्ड डिज़ाइन-रुचि स्मृति।**

आप जो डिज़ाइन पसंद करते हैं उन्हें देखते हैं, सूक्ष्म निर्णय देते हैं ("टाइपोग्राफ़ी शानदार है, पर रंग-संयोजन बहुत ठंडा है"), और वे एक स्थानीय स्मृति में जमा होते जाते हैं। बाद में जब आप Claude Code से कोई फ़्रंटएंड बनाने को कहते हैं, तो `/design` उस संचित रुचि को लोड कर लेता है ताकि परिणाम और भी आप *जैसा* दिखे — हर ब्रांड के अनुसार, और हर चक्र के साथ और भी पैना होता जाता है।

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

यह **ब्रांड-स्कोप्ड** है: एक आधारभूत स्वयं-ब्रांड (`_personal`) जिसकी रुचि हर ब्रांड में प्रवाहित होती है, और साथ ही नामित ब्रांड जिनके केस कभी एक-दूसरे में नहीं रिसते।

---

## यह कैसे काम करता है

- **Vault (वॉल्ट)** — आपकी रुचि का एकमात्र सत्य-स्रोत, markdown + YAML का एक सादा फ़ोल्डर जो आपका अपना है और जिसे आप स्वयं `git` कर सकते हैं (इस रिपॉज़िटरी के बाहर रखा जाता है)। इसमें प्रति-ब्रांड **स्टाइल गाइड (style guides)**, पसंद किए गए **केस (cases)**, एक **anti-library**, और **NEVER नियम** होते हैं।
- **Sidecar (साइडकार)** — एक छोटा, हमेशा-चालू स्थानीय Express डेमॉन (`127.0.0.1:5174`) जो वॉल्ट का एक retrieval-scoped, मर्ज किया हुआ दृश्य HTTP पर परोसता है (`/api/context`, `/api/distill/:brand`, …)। पढ़ने वाले एंडपॉइंट लूपबैक के लिए खुले हैं; लिखने के लिए एक स्थानीय API टोकन चाहिए।
- **MCP server** — sidecar को इस तरह लपेटता है कि कोई एजेंट (जैसे एक स्थानीय Hermes एजेंट) 7 टूल्स के साथ संदर्भ पढ़ सके और नई रुचि कैप्चर कर सके।
- **`/design`** — Claude Code उपभोक्ता: ब्रांड की मर्ज की हुई स्मृति को लोड करता है और उसे जनरेशन प्रॉम्प्ट में ढालता है (ब्रांड गाइड → अनुसरण करें, NEVER नियम → कठोर बाध्यताएँ, पसंद किए गए केस → अनुकरण करें, anti-cases → टालें)।

### मूल अवधारणाएँ

| शब्द | अर्थ |
|------|---------|
| **Brand (ब्रांड)** | एक रुचि-स्कोप। `_personal` = स्वयं-ब्रांड (आधारभूत, सबमें प्रवाहित)। नामित ब्रांड क्लाइंट-विशिष्ट होते हैं। |
| **Case (केस)** | एक कैप्चर किया हुआ डिज़ाइन (स्क्रीनशॉट + निकाले गए टोकन) आपके उद्धरणों और निर्णय के साथ। |
| **Aspect (पहलू)** | किसी केस पर प्रति-आयाम (per-dimension) निर्णय — `{dimension, verdict: like\|dislike, note}`। कोई डिज़ाइन शायद ही कभी पूरी तरह अच्छा होता है। |
| **Style guide (स्टाइल गाइड)** | प्रति-ब्रांड markdown नियम (वैश्विक स्वयं-ब्रांड गाइड + प्रति-ब्रांड ओवरराइड)। |
| **NEVER rule (NEVER नियम)** | एक डिटेक्टर के साथ कठोर बाध्यता, जिसे लिंटर द्वारा जनरेट किए गए CSS पर लागू किया जाता है। |
| **Distillation (आसवन)** | संचित like/dislike संकेतों को प्रस्तावित NEVER / style-note उम्मीदवारों में क्लस्टर करना — **अनुमोदन-गेटेड (approval-gated)**, कभी स्वतः नहीं लिखा जाता। |

---

## यह लूप

- **इनपुट** — एक स्थानीय Hermes एजेंट का दैनिक cron डिज़ाइन उम्मीदवार सामने लाता है; आप उनकी समीक्षा करते हैं और प्रति-पहलू निर्णयों के साथ जवाब देते हैं; यह उन्हें MCP टूल्स के ज़रिए वॉल्ट में कैप्चर कर लेता है।
- **आउटपुट** — Claude Code में: `/design "<task>" <brand> <scenario>` ब्रांड की मर्ज की हुई स्मृति को लोड करता है और संचित रुचि के अनुसार एक फ़्रंटएंड जनरेट करता है।
- **संयुक्त वृद्धि (Compound)** — जैसे-जैसे संकेत जमा होते हैं, `distill_taste` उन्हें टिकाऊ नियम-उम्मीदवारों में क्लस्टर करता है; आप अनुमोदन करते हैं; नियम ब्रांड की स्टाइल गाइड में दर्ज हो जाता है; और `/design` और पैना हो जाता है।

[`open-design`](https://github.com/zhenheco/open-design) वैकल्पिक रूप से उसी संदर्भ का उपभोग एक तीसरे (केवल-पठनीय) जनरेशन स्टूडियो के रूप में `design-memory-bridge` स्किल के माध्यम से कर सकता है।

---

## इंस्टॉल

आवश्यकताएँ: **Node ≥ 20** (sidecar `better-sqlite3` 12.x का उपयोग करता है; Node 26 चलेगा), और [Claude Code](https://claude.com/claude-code)।

एक ही कमांड — क्लोन करें और इंस्टॉलर चलाएँ:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

`install.sh` निर्भरताएँ इंस्टॉल करता है, डैशबोर्ड बनाता है, स्किल को Claude Code में लिंक करता है (`~/.claude/skills/design-lab`), एक वॉल्ट आरंभ करता है, sidecar शुरू करता है (macOS पर एक launchd डेमॉन; अन्यत्र माँग पर स्वतः-स्पॉन होता है), और MCP server को रजिस्टर करने का तरीका छापता है। यह idempotent है — `git pull` के बाद दोबारा चलाना सुरक्षित है।

सत्यापित करें:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

वॉल्ट डिफ़ॉल्ट रूप से `~/Documents/CC Cli/design-library` होता है; इसे `DESIGN_LAB_VAULT_PATH` से ओवरराइड करें। `capture_url` स्क्रीनशॉट टूल का उपयोग करने के लिए, `npx playwright install chromium` भी चलाएँ।

### MCP server रजिस्टर करें

अपने एजेंट को stdio एंट्री `skill/mcp/start.sh` की ओर इंगित करें — यह सभी 7 टूल्स को स्वतः खोज लेता है। उदाहरण के लिए:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### अपनी रुचि के साथ जनरेट करें

```bash
/design "build a landing hero" <brand> landing
```

---

## MCP टूल्स

| टूल | उद्देश्य |
|------|---------|
| `get_context` | ब्रांड का retrieval-scoped संदर्भ पढ़ें (स्टाइल गाइड + केस + NEVER नियम)। |
| `list_clients` | ब्रांड सूचीबद्ध करें। |
| `add_case` | किसी स्थानीय इमेज पाथ से एक केस कैप्चर करें। |
| `capture_url` | किसी URL का स्क्रीनशॉट लें, लाइव कंप्यूटेड डिज़ाइन टोकन निकालें, और केस के रूप में सहेजें। |
| `add_feedback` | किसी एक इमेज से न जुड़े रुचि-संकेत को लॉग करें। |
| `edit_style_guide` | वैश्विक या प्रति-ब्रांड स्टाइल गाइड संपादित करें (हैश-संघर्ष से संरक्षित)। |
| `distill_taste` | संचित like/dislike संकेतों को नियम-उम्मीदवारों में क्लस्टर करें (केवल-पठनीय; सहेजे जाने से पहले आप अनुमोदन करते हैं)। |

लिखने के लिए स्थानीय API टोकन चाहिए (`X-Design-Lab-Token`, प्रति अनुरोध `~/.claude/state/design-lab/api-token` से पढ़ा जाता है)। Host allowlist + टोकन sidecar को स्थानीय ब्राउज़रों से होने वाले DNS-rebinding से बचाते हैं।

---

## प्रोजेक्ट संरचना

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

## टेस्ट

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## डिज़ाइन निर्णय

देखें [`docs/adr/`](docs/adr/):

- **0001** — design-lab और open-design को अलग-अलग कोडबेस के रूप में रखें।
- **0002** — sidecar को लपेटने वाले एक MCP server के ज़रिए एजेंट के साथ एकीकृत करें।
- **0003** — प्रति-ब्रांड स्टाइल गाइड `/api/context` में मर्ज की गई हैं।
- **0004** — पहलू-आधारित (प्रति-आयाम) केस फ़ीडबैक।
- **0005** — अनुमोदन-गेटेड आसवन (sidecar में नियतात्मक क्लस्टर, किसी भी लेखन से पहले LLM ड्राफ़्टिंग + मानव अनुमोदन)।

## सुरक्षा

Local-first और टोकन-संरक्षित। हर PR पर निःशुल्क SAST (Semgrep + Gitleaks + Trivy), साथ ही Dependabot और सीक्रेट स्कैनिंग। वॉल्ट और API टोकन इस रिपॉज़िटरी के बाहर रहते हैं और कभी कमिट नहीं किए जाते।

---

*स्थिति: v0.4 — कैप्चर करें, संवाद करें, संयुक्त रूप से बढ़ाएँ।*
