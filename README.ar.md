# design-lab

<samp>[English](README.md) · [繁體中文](README.zh-Hant.md) · [简体中文](README.zh-Hans.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt-BR.md) · [Русский](README.ru.md) · [Italiano](README.it.md) · [Türkçe](README.tr.md) · [हिन्दी](README.hi.md) · **العربية** · [Bahasa Indonesia](README.id.md) · [Tiếng Việt](README.vi.md) · [ไทย](README.th.md) · [Polski](README.pl.md)</samp>

**ذاكرة ذوق تصميمي شخصية ومحدّدة النطاق بحسب العلامة التجارية، مخصّصة لـ Claude Code.**

ترى تصاميم تعجبك، فتُبدي أحكامًا دقيقة ("الطباعة رائعة، لكن لوحة الألوان باردة أكثر مما ينبغي")، فتتراكم هذه الأحكام لتكوّن ذاكرة محلية. وعندما تطلب لاحقًا من Claude Code أن يبني واجهة أمامية، يحمّل `/design` ذلك الذوق المتراكم لتبدو النتيجة أقرب إلى *ذوقك أنت* — لكل علامة تجارية على حدة، وتزداد دقّةً مع كل دورة.

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

النظام **محدّد النطاق بحسب العلامة التجارية**: علامة تجارية ذاتية أساسية (`_personal`) يتدفّق ذوقها إلى كل العلامات التجارية، إضافة إلى علامات تجارية مُسمّاة لا تتسرّب حالاتها (cases) أبدًا من إحداها إلى الأخرى.

---

## كيف يعمل

- **القبو (Vault)** — المصدر الوحيد للحقيقة بشأن ذوقك، وهو مجلّد بسيط من ملفات markdown وYAML تملكه أنت ويمكنك إدارته عبر `git` بنفسك (محفوظ خارج هذا المستودع). يحتوي على **أدلة الأسلوب (style guides)** لكل علامة تجارية، و**الحالات (cases)** التي أعجبتك، و**مكتبة مضادة (anti-library)**، و**قواعد NEVER**.
- **الواجهة الجانبية (Sidecar)** — خفيّ Express محلي صغير يعمل دائمًا (`127.0.0.1:5174`) يقدّم عبر HTTP عرضًا مدمجًا محدود النطاق بالاسترجاع للقبو (`/api/context`، `/api/distill/:brand`، …). نقاط نهاية القراءة مفتوحة على حلقة الاستعادة المحلية (loopback)؛ أمّا عمليات الكتابة فتتطلّب رمز API محلي.
- **خادم MCP** — يغلّف الواجهة الجانبية بحيث يستطيع وكيل (مثل وكيل Hermes محلي) قراءة السياق والتقاط ذوق جديد عبر 7 أدوات.
- **`/design`** — المستهلك في Claude Code: يحمّل الذاكرة المدمجة للعلامة التجارية ويصوغها (دليل العلامة التجارية ← اتّبعه، قواعد NEVER ← قيود صارمة، الحالات المُعجبة ← قلّدها، الحالات المضادة ← تجنّبها) داخل موجّه التوليد.

### المفاهيم الأساسية

| المصطلح | المعنى |
|------|---------|
| **Brand (العلامة التجارية)** | نطاق ذوق. `_personal` = العلامة التجارية الذاتية (الأساس، يتدفّق إلى الجميع). أمّا العلامات المُسمّاة فمخصّصة لعملاء بعينهم. |
| **Case (الحالة)** | تصميم واحد ملتقَط (لقطة شاشة + رموز مستخرَجة) مع اقتباساتك وحكمك عليه. |
| **Aspect (الجانب)** | حكم على بُعد واحد من أبعاد الحالة — `{dimension, verdict: like\|dislike, note}`. فالتصميم نادرًا ما يكون جيّدًا بالكامل. |
| **Style guide (دليل الأسلوب)** | قواعد markdown لكل علامة تجارية (دليل العلامة الذاتية العام + تجاوزات خاصة بكل علامة تجارية). |
| **NEVER rule (قاعدة NEVER)** | قيد صارم مزوّد بكاشف، يُفرَض على CSS المولَّد بواسطة أداة الفحص (linter). |
| **Distillation (التقطير)** | تجميع إشارات الإعجاب/عدم الإعجاب المتراكمة في مرشّحين مقترَحين لقواعد NEVER / ملاحظات أسلوب — **مشروط بالموافقة**، ولا يُكتب آليًا أبدًا. |

---

## الحلقة

- **المدخل** — يطفو وكيل Hermes المحلي بمهمّته اليومية المجدولة (cron) مرشّحي تصميم؛ فتراجعها وتردّ بأحكام لكل جانب على حدة؛ ثم يلتقطها إلى القبو عبر أدوات MCP.
- **المخرج** — في Claude Code: يحمّل `/design "<task>" <brand> <scenario>` الذاكرة المدمجة للعلامة التجارية ويولّد واجهة أمامية بالذوق المتراكم.
- **المضاعفة (Compound)** — مع تراكم الإشارات، يجمّعها `distill_taste` في مرشّحي قواعد دائمة؛ فتوافق عليها؛ فتُضاف القاعدة إلى دليل أسلوب العلامة التجارية؛ فيزداد `/design` دقّةً.

يمكن لـ [`open-design`](https://github.com/zhenheco/open-design) اختياريًا أن يستهلك السياق نفسه بوصفه استوديو توليد ثالثًا (للقراءة فقط) عبر مهارة `design-memory-bridge`.

---

## التثبيت

المتطلّبات: **Node ≥ 20** (تستخدم الواجهة الجانبية `better-sqlite3` 12.x؛ وNode 26 لا بأس به)، و[Claude Code](https://claude.com/claude-code).

أمر واحد — استنسخ المستودع وشغّل المثبّت:

```bash
git clone https://github.com/zhenheco/design-lab.git
cd design-lab
bash install.sh
```

يثبّت `install.sh` الاعتماديات، ويبني لوحة التحكّم، ويربط المهارة داخل Claude Code (`~/.claude/skills/design-lab`)، ويهيّئ قبوًا، ويشغّل الواجهة الجانبية (خفيّ launchd على macOS؛ ويُستدعى تلقائيًا عند الطلب في غير ذلك)، ويطبع كيفية تسجيل خادم MCP. وهو عملية متكرّرة آمنة (idempotent) — يمكن إعادة تشغيله بأمان بعد `git pull`.

للتحقّق:

```bash
curl -s http://127.0.0.1:5174/api/health        # → {"status":"ok"}
```

يكون القبو افتراضيًا في `~/Documents/CC Cli/design-library`؛ ويمكن تجاوز ذلك عبر `DESIGN_LAB_VAULT_PATH`. ولاستخدام أداة لقطة الشاشة `capture_url`، شغّل أيضًا `npx playwright install chromium`.

### تسجيل خادم MCP

وجّه وكيلك إلى مدخل stdio عند `skill/mcp/start.sh` — فهو يكتشف الأدوات السبع كلها تلقائيًا. على سبيل المثال:

```bash
claude mcp add design-lab -- bash "$(pwd)/skill/mcp/start.sh"
```

### ولّد بذوقك

```bash
/design "build a landing hero" <brand> landing
```

---

## أدوات MCP

| الأداة | الغرض |
|------|---------|
| `get_context` | قراءة السياق المحدود النطاق بالاسترجاع للعلامة التجارية (دليل الأسلوب + الحالات + قواعد NEVER). |
| `list_clients` | سرد العلامات التجارية. |
| `add_case` | التقاط حالة من مسار صورة محلية. |
| `capture_url` | التقاط لقطة شاشة لعنوان URL، واستخراج رموز التصميم المحسوبة حيًّا، وحفظها كحالة. |
| `add_feedback` | تسجيل إشارة ذوق غير مرتبطة بصورة واحدة. |
| `edit_style_guide` | تحرير دليل الأسلوب العام أو الخاص بكل علامة تجارية (محميّ من تعارض التجزئة hash). |
| `distill_taste` | تجميع إشارات الإعجاب/عدم الإعجاب المتراكمة في مرشّحي قواعد (للقراءة فقط؛ توافق أنت قبل الحفظ). |

تتطلّب عمليات الكتابة رمز API المحلي (`X-Design-Lab-Token`، يُقرأ لكل طلب من `~/.claude/state/design-lab/api-token`). وتعمل قائمة المضيفين المسموح بهم (Host allowlist) إضافةً إلى الرمز على حماية الواجهة الجانبية من إعادة ربط DNS (DNS-rebinding) من المتصفّحات المحلية.

---

## بنية المشروع

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

## الاختبارات

```bash
npm test            # unit + integration (node:test + tsx)
npm run test:e2e    # dashboard HTTP smoke
npm run test:dashboard   # dashboard component tests (vitest) + astro check
```

## قرارات التصميم

انظر [`docs/adr/`](docs/adr/):

- **0001** — إبقاء design-lab وopen-design قاعدتي شيفرة منفصلتين.
- **0002** — التكامل مع الوكيل عبر خادم MCP يغلّف الواجهة الجانبية.
- **0003** — أدلة الأسلوب الخاصة بكل علامة تجارية مدمجة في `/api/context`.
- **0004** — تغذية راجعة على الحالات وفق الأبعاد (لكل بُعد على حدة).
- **0005** — تقطير مشروط بالموافقة (تجميعات حتمية في الواجهة الجانبية، صياغة بواسطة نموذج لغوي كبير LLM، وموافقة بشرية قبل أي كتابة).

## الأمان

محلّي أولًا ومحميّ برمز. فحص SAST مجاني على كل طلب سحب PR (Semgrep + Gitleaks + Trivy)، إضافةً إلى Dependabot وفحص الأسرار (secret scanning). يقيم القبو ورمز API خارج هذا المستودع ولا يُودَعان فيه أبدًا.

---

*الحالة: v0.4 — التقاط، محادثة، مضاعفة.*
