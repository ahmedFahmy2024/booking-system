# دليل الـ Skills المتاحة في المشروع

## مقدمة

الـ skills بتاعت المشروع موجودة في المجلد [`.agents/skills`](../.agents/skills). كل skill عبارة عن مجلد جواه ملف `SKILL.md` (وممكن يكون معاه ملفات مرجعية إضافية جوه `references/` و `templates/` و غيرها).

الـ agent بيحمل الـ skill تلقائياً لما المهمة المطلوبة تطابق الـ **description** المكتوبة في بداية ملف `SKILL.md`. يعني انت مش محتاج تستدعيها بإيدك في العادي — بس من المفيد تعرف كل واحدة بتعمل إيه وامتى بتتحمل، عشان تكتب طلباتك بشكل واضح وتستفيد منها.

> ملاحظة: مصادر الـ skills و إصداراتها متسجلة في ملف [`skills-lock.json`](../skills-lock.json).

---

## نظرة سريعة

| الـ Skill | متى تستخدمه (باختصار) |
| --- | --- |
| `agent-browser` | أي تعامل مع متصفح: فتح صفحة، تعبئة فورم، ضغط زرار، سكرين شوت، سحب بيانات، أو اختبار تطبيق ويب/تطبيق Electron (زي VS Code و Slack). |
| `drizzle` | كتابة أو تعديل schema واستعلامات Drizzle: جداول، indexes، relations، joins، والأنواع المستنتجة. |
| `feature-sliced-design` | تنظيم هيكل frontend حسب منهجية FSD v2.1: طبقات، slices، public APIs، حدود الاستيراد، ونقل الكود بين الطبقات. |
| `hono` | بناء تطبيقات Hono: الـ routing، الـ middleware، الـ validation، الـ JSX، والاختبار عبر Hono CLI. |
| `hono-jsx` | بناء واجهة Hono باستخدام `hono/jsx` (صفحات، layouts، forms) بدل React، مع SSR و client components. |
| `hono-void` | فحص واختبار تطبيقات Void المبنية على Hono (صفحات، page actions، و API routes) باستخدام Hono CLI. |
| `neon-drizzle` | إعداد Drizzle من الصفر على Neon أو إضافته لتطبيق موجود: تثبيت، إعداد الاتصال، توليد schema، وتشغيل migrations. |
| `neon-postgres` | التعامل مع قاعدة بيانات Neon/Lakebase Postgres الموجودة: الاتصالات، migrations، branching، الفواتير، البحث (vector/full-text/hybrid). |
| `vite` | إعداد وضبط Vite: الـ config، الـ plugins، الـ SSR، وبناء المكتبات، وترقية Vite 8 إلى Rolldown. |
| `vitest` | كتابة اختبارات بـ Vitest: الـ API، الـ mocking، الـ coverage، الـ filtering، والـ fixtures. |

---

## تفاصيل كل Skill

### 1. `agent-browser`

- **الوظيفة:** أداة CLI لأتمتة المتصفح بتستخدم Chrome/Chromium عبر CDP، مع لقطات accessibility tree ومراجع عناصر `@eN` للتعامل الموثوق مع الصفحات.
- **امتى تستخدمه:**
  - فتح موقع، التنقل بين صفحاته، تعبئة فورم، الضغط على زرار، أو أخذ سكرين شوت.
  - سحب بيانات من صفحة (scraping) أو اختبار تطبيق ويب (QA / استكشاف / البحث عن bugs).
  - أتمتة تطبيقات Electron زي VS Code و Slack و Discord و Figma و Notion.
  - فحص Slack unreads، إرسال رسائل، أو البحث في المحادثات.
  - تشغيل المتصفح جوه Vercel Sandbox أو AWS Bedrock AgentCore.
- **ملاحظة مهمة:** هذا الملف مجرد "discovery stub". قبل أي أمر لازم تحمل الدليل الفعلي من الـ CLI:
  ```bash
  agent-browser skills get core
  ```
  وفيه أدوات متخصصة زي `electron` و `slack` و `dogfood` و `derive-client`.

### 2. `drizzle`

- **الوظيفة:** دليل أسلوب كتابة schema واستعلامات Drizzle ORM (جداول، أعمدة، indexes، relations، joins، والأنواع المستنتجة).
- **امتى تستخدمه:**
  - إضافة أو تعديل جدول/عمود في الـ schema.
  - كتابة relations و joins واستعلامات Drizzle.
  - تسمية الجداول والأعمدة بشكل متسق مع الموجود في المشروع.
- **ملاحظة:** الـ skill ده مسؤول عن **الشكل والأسلوب** بس. أما نشر الـ migrations وتشغيلها فمكانها في `neon-drizzle` / `neon-postgres`. (في الـ description بتاعه مكتوب إن rollout يخص `db-migrations`، وهو مش موجود في المشروع ده — فالمقابل هنا هو `neon-drizzle`.)

### 3. `feature-sliced-design`

- **الوظيفة:** النسخة الرسمية من منهجية Feature-Sliced Design v2.1 specially للـ frontend.
- **امتى تستخدمه:**
  - تحديد مكان الكود الجديد (أي طبقة وأي slice): `app/` و `pages/` و `features/` و `entities/` و `shared/`.
  - تعريف الـ public API لكل slice وضبط حدود الاستيراد (منع الـ cross-imports).
  - ترتيب الأصول الثابتة (صور، أيقونات، خطوط، PDFs).
  - القرار بإنشاء أو حذف entity، أو الاستغناء عن طبقة `widgets/` (المنهي عنها).
  - نقل مشروع من FSD v2.0 أو من هيكل مش FSD، أو دمج FSD مع Vite/React Router/Next/Nuxt.
  - تطبيق أنماط شائعة زي الـ authentication و API layer و Redux و TanStack Query جوه FSD.
- **القاعدة الذهبية:** "ابدأ بسيط واستخرج الكود عند الحاجة" — الكود يروح `pages/` أولاً، ومفيش استخراج إلا لما نفس الكود مستخدم في أكتر من مكان دلوقتي، وليه سبب تغيير مستقل، وله مسؤولية واضحة.

### 4. `hono`

- **الوظيفة:** معرفة API متكاملة عن Hono وبناء تطبيقاته، مع استخدام Hono CLI للفحص والاختبار بدل سكربتات مؤقتة أو dev server.
- **امتى تستخدمه:**
  - بناء API أو تطبيق Hono (ال constructs، routing، middleware، JSX، validation، streaming).
  - لما الكود يعمل `import ... from 'hono'` أو `'hono/*'`.
  - لما المستخدم يذكر "Hono" صراحة.
  - فحص المسارات والردود:
    ```bash
    npx hono routes
    npx hono request /path
    npx hono batch -
    npx hono snapshot
    ```

### 5. `hono-jsx`

- **الوظيفة:** بناء UI لتطبيقات Hono باستخدام `hono/jsx` — SSR أولاً، مع شوية JSX في المتصفح بس لو محتاج حالة (state).
- **امتى تستخدمه:**
  - إنشاء صفحات، layouts، forms، أو أجزاء تفاعلية في مشروع Hono.
  - لما `tsconfig` فيه `"jsxImportSource": "hono/jsx"`، أو الكود يعمل import من `hono/jsx` / `hono/jsx/dom` / `hono/jsx-renderer` / `vite-ssr-components`.
- **قاعدة صارمة:** **مفيش React هنا** — ما تتثبتش `react` ولا `react-dom`، واكتب `class` مش `className`. (ده مش مطبق في المشروع ده لأن الـ frontend هنا React/Vite.)

### 6. `hono-void`

- **الوظيفة:** فحص واختبار تطبيقات Void (إطار عمل مبني على Hono، يعتمد على file-based routes ومفيش entry file).
- **امتى تستخدمه:**
  - لما `package.json` فيه dependency اسمه `void`، أو فيه `void.config.ts`، أو المستخدم يذكر Void.
  - اختبار الـ pages والـ page actions والـ API routes عبر Hono CLI:
    ```bash
    npx hono routes --exclude /__void
    npx hono request /
    npx hono browse /
    ```
- **ملاحظة:** الـ validation failure في page action بترجع 200 مش 422 — لازم تتحقق من `body.errors`. (مش مطبق في المشروع ده حالياً.)

### 7. `neon-drizzle`

- **الوظيفة:** إعداد Drizzle ORM كامل على Neon — تثبيت الحزم، تجهيز بيانات الاتصال، ضبط الـ connection، توليد الـ schema، وتشغيل الـ migrations. النتيجة كود شغال يتصل بقاعدة البيانات فوراً.
- **امتى تستخدمه:**
  - عمل مشروع جديد بـ Drizzle (Next.js, Vite, Express, ...).
  - إضافة Drizzle لتطبيق موجود.
  - إنشاء أو تعديل database schema.
  - حل مشاكل الـ migrations.
- **بيختار تلقائياً** الدليل المناسب حسب السياق: `guides/new-project.md` أو `existing-project.md` أو `schema-only.md` أو `troubleshooting.md`، ويقرر بين HTTP adapter و WebSocket adapter.

### 8. `neon-postgres`

- **الوظيفة:** أفضل الممارسات للتعامل مع Lakebase Postgres على Neon (قاعدة البيانات اللي المشروع بيستخدمها).
- **امتى تستخدمه:**
  - عند وجود `DATABASE_URL` أو العمل بـ SQL / schema / inspect / search.
  - اختيار نوع الاتصال: pooled للويب والـ serverless، direct للـ migrations.
  - إدارة الـ branching (schema-only branch، reset-from-parent، branch-per-PR).
  - الـ autoscaling والـ scale-to-zero والـ instant restore والـ read replicas.
  - تقليل الفواتير وحجم الـ egress، وحل مشكلة الـ compute المتوقف (SQLSTATE 53000 / HTTP 402).
  - تحسين `SELECT *` وتقليل الـ overfetching.
  - البحث: vector search، full-text search، BM25، و hybrid search.
- **تنبيه:** لو مفيش `DATABASE_URL` أو المشروع جديد، الـ skill بيقول ترجع للأب `neon` (مش مثبت هنا — ممكن تجيبه من `neon skills -s neon -y`). والـ auth يروح `neon-auth` والـ realtime يروح `neon-realtime`.

### 9. `vite`

- **الوظيفة:** إعداد وضبط Vite — الـ config، الـ plugin API، الـ SSR، بناء المكتبات، وترقية Vite 8 (اللي بيستخدم Rolldown و Oxc بدل esbuild + Rollup).
- **امتى تستخدمه:**
  - تعديل `vite.config.ts` (مثل إضافة alias `@` أو plugins).
  - كتابة Vite plugin أو التعامل مع virtual modules وترتيب الـ plugins.
  - استخدام `import.meta.glob` و `import.meta.env` و asset queries زي `?raw` و `?url` و HMR API.
  - بناء library أو SSR middleware.
  - الترقية إلى Vite 8 وفهم التغييرات.
- **تفضيلات:** استخدم TypeScript (`vite.config.ts`) و ESM دايماً.

### 10. `vitest`

- **الوظيفة:** إطار اختبار سريع مبني على Vite، متوافق مع Jest API، مدعوم بالـ TypeScript والـ ESM والـ JSX.
- **امتى تستخدمه:**
  - كتابة اختبارات وحدة أو تكامل (`test` / `it` / `describe` / `expect`).
  - الـ mocking والـ spies والـ fake timers عبر `vi`.
  - قياس الـ coverage بـ V8 أو Istanbul.
  - فلترة الاختبارات بالاسم أو بالـ tags، واستخدام الـ fixtures و `test.extend`.
  - اختبارات الأنواع (`expectTypeOf`) والـ benchmarks والمشاريع المتعددة.
- **ملاحظة:** الـ Vitest بيشارك نفس الـ config والـ plugins بتاعة Vite، فتعديلات `vite.config.ts` بتأثر على الاختبارات كمان.

---

## ربط الـ Skills ببنية المشروع ده

المشروع (زي ما في [`AGENTS.md`](../AGENTS.md)) مكوّن من React + Vite في `apps/web`، و Hono API في `apps/api`، و Neon Postgres خلف الـ API. الـ skills الأقرب لكل جزء:

| جزء المشروع | الـ Skills المرتبطة |
| --- | --- |
| `apps/web` (React + Vite) | `vite`، `feature-sliced-design`، `vitest`، `agent-browser` لاختبار الواجهة |
| `apps/api` (Hono) | `hono`، و `drizzle` + `neon-drizzle` + `neon-postgres` لطبقة قاعدة البيانات |
| قاعدة البيانات (Neon Postgres) | `neon-postgres` للإدارة والاستعلامات، `neon-drizzle` للإعداد والـ migrations |
| اختبارات | `vitest` للوحدة، `agent-browser` للـ E2E/QA، Hono CLI (جوه `hono`) لاختبار الـ API |

أما `hono-jsx` و `hono-void` فهم **مش مستخدمين في الوضع الحالي**؛ بيتحملوا بس لو اتغير الـ frontend من React إلى `hono/jsx` أو لو دخلنا إطار Void.
