# دليل المكتبات المثبّتة في المشروع

## مقدمة

المشروع فيه مكتبات مثبّتة بالفعل في ملفي `package.json` الخاصين بـ [`apps/web`](../apps/web/package.json) و [`apps/api`](../apps/api/package.json). الهدف من الملف ده إن الـ agent يعرف **إيه الموجود أصلاً**، فيستخدمه بدل ما يحاول يعمل نسخة بنفسه من الصفر أو يجيب بديل (مثلاً يعمل routing بإيده، أو يضيف Express، أو يستخدم Axios بدل الـ fetch الحالي، أو يضيف Jest مع Vitest).

> **القاعدة الذهبية:** قبل ما تضيف أي dependency أو تكتب حل مخصص، دور هنا الأول. لو المكتبة موجودة — استخدمها بالطريقة الموثقة في المشروع ده. لو المكتبة مش موجودة ومن غير بديل واضح، اسأل قبل التثبيت.

الإصدارات المذكورة مأخوذة من `package.json` وقت كتابة الملف. لو احتجت تتحقق من سلوك مكتبة أو من API بالضبط، استخدم `opensrc` (شوف قسم **Source verification in code review (opensrc)** في [`AGENTS.md`](../AGENTS.md)) — مصدر الحزمة هو المرجع مش التخمين.

---

## نظرة سريعة

| المكتبة | الإصدار | أين | متى تستخدمها (باختصار) |
| --- | --- | --- | --- |
| `react` | 19.3.1 | web | بناء كل مكوّنات الواجهة. |
| `react-dom` | 19.3.1 | web | تصيير التطبيق في الـ DOM (`main.tsx`). |
| `@tanstack/react-router` | 1.170.46 | web | كل routings و loaders و search params. |
| `@tanstack/react-query` | 5.108.2 | web | كل بيانات الـ API: fetching/caching/mutations. |
| `react-hook-form` | 7.92.0 | web | حالة الفورم والتعامل مع الإرسال والأخطاء. |
| `@hookform/resolvers` | 7.0.8 | web | ربط Zod schema بالفورم (`zodResolver`). |
| `zod` | 4.6.7 | web + api | تعريف وتحقق الـ schemas في الطرفين. |
| `hono` | 4.13.16 | api | بناء الـ API وكل route groups. |
| `@hono/node-server` | 2.1.3 | api | تشغيل تطبيق Hono على Node. |
| `@hono/zod-validator` | 0.9.1 | api | التحقق من الـ request body بـ Zod middleware. |
| `drizzle-orm` | 0.45.4 | api | الـ schema والاستعلامات (SELECT/INSERT/...). |
| `@neondatabase/serverless` | 1.2.1 | api | الـ connection بـ Neon عبر HTTP. |
| `drizzle-kit` | 0.31.11 | api (dev) | توليد وتشغيل الـ migrations و `db:push`/`studio`. |
| `vite` | 8.3.6 | web (dev) | الـ dev server والبناء. |
| `@vitejs/plugin-react` | 6.1.2 | web (dev) | دعم React و Fast Refresh في Vite. |
| `@tanstack/router-plugin` | 1.169.0 | web (dev) | توليد الـ routes من الملفات و `routeTree.gen.ts`. |
| `@tanstack/devtools*` | 0.8.7–0.17.0 | web (dev) | لوحة الـ devtools لـ Query و Router. |
| `typescript` | ~7.0.2 / 7.0.2 | web + api (dev) | الأنواع والـ typecheck في كل الأكواد. |
| `oxlint` | 1.90.0 / 1.94.0 | web + api (dev) | الـ lint بدل ESLint. |
| `vitest` | 5.1.1 | web + api (dev) | كل اختبارات الوحدة والتكامل. |
| `@testing-library/react` | 16.3.3 | web (dev) | اختبار مكوّنات React. |
| `jsdom` | 31.0.1 | web (dev) | بيئة DOM لاختبارات Vitest. |
| `@playwright/test` | 1.65.1 | web (dev) | اختبارات E2E. |
| `tsx` | 4.23.0 | api (dev) | تشغيل سكربتات TypeScript (`dev`, `db:seed`, E2E). |
| `dotenv` | 18.0.10 | api (dev) | تحميل `.env` / `.env.test`. |
| `@types/*` | — | web + api (dev) | تعريفات الأنواع لـ React و Node. |

---

## تفاصيل كل مكتبة

### أ) واجهة الويب — `apps/web`

#### 1. `react` (^19.3.1)

- **الوظيفة:** مكتبة بناء الواجهة. كل المكوّنات في `src/features/**` و `src/app/**` مكوّنات React.
- **امتى تستخدمه:** أي UI جديد، hooks (`useState`, `useEffect`)، و `Suspense`/`ErrorBoundary` اللي بيستخدمها الـ router والـ Query.
- **قاعدة:** استخدم hooks بتاعة React عشان حالة الـ UI المحلية فقط. أما بيانات الـ API فـ `react-query` (رقم 4)، وأما حالة الفورم فـ `react-hook-form` (رقم 5). متستخدمش `useState`/`useEffect` عشان تجلب بيانات من الـ API.

#### 2. `react-dom` (^19.3.1)

- **الوظيفة:** تصيير شجرة React في المتصفح.
- **تفاصيل في المشروع ده:** مستخدم في `src/app/main.tsx` مع `createRoot`، опять من غير `StrictMode` زي ما هو موجود.
- **قاعدة:** متضفش مكتبة تصيير تانية، ومتعملش تعديل على ملف الـ entry إلا بسبب واضح.

#### 3. `@tanstack/react-router` (^1.170.46)

- **الوظيفة:** routing آمن النوع مع file-based routes و loaders و search params.
- **امتى تستخدمه:** إضافة أو تعديل route في `src/app/routes/`.
- **تفاصيل في المشروع ده:** مفعّل بـ `@tanstack/router-plugin` (رقم 9) مع `autoCodeSplitting`. الـ `routeTree.gen.ts` مولّد — **ممنوع التعديل عليه بإيد**. الـ `router` بيتعمل في `src/app/router.tsx` وياخد الـ `queryClient` من الـ context.
- **قاعدة:** متكتبش نظام routing مخصص، ومتضفش `react-router-dom` جنبه. الدليل الكامل في skill `tanstack-router`.

#### 4. `@tanstack/react-query` (^5.108.2)

- **الوظيفة:** إدارة server state: الـ fetching، الـ caching، background refetch، mutations، و Suspense.
- **امتى تستخدمه:** أي قراءة أو كتابة للـ API.
- **تفاصيل في المشروع ده:**
  - `queryOptions` معرّفة في `pages/bookings/api/bookings.queries.ts` وتُشارك بين الـ loader والمكوّن.
  - الـ loader بينادي `queryClient.query({ ...options, staleTime: 'static' })`؛ المكوّن بيقرأ بـ `useSuspenseQuery`.
  - `ensureQueryData` و `prefetchQuery` **deprecated** — متستخدمهمش.
  - error component لازم يعمل `useQueryErrorResetBoundary().reset()` ويعيد via `router.invalidate()` (شوف `src/app/ui/route-error.tsx`).
- **قاعدة:** متستبدلش بـ SWR أو Redux Toolkit Query أو `useState` + `fetch`. الدليل الكامل في skill `tanstack-query`.

#### 5. `react-hook-form` (^7.92.0)

- **الوظيفة:** إدارة حالة الفورم (القيم، اللمس، الأخطاء، حالة الإرسال) من غير re-renders زايدة.
- **امتى تستخدمه:** أي فورم، زي `pages/bookings/ui/BookingForm.tsx`.
- **تفاصيل في المشروع ده:** بنستخدم `useForm<Values, unknown, Output>` مع `register` و `handleSubmit` و `setError('root.serverError', ...)`. إعادة تعيين الفورم بتحصل بعد ما الـ submit transition يتcommit، مش جوه الـ handler (شوف التعليق في الملف).
- **قاعدة:** متعملش حالات فورم مخصصة بـ `useState` لكل حقل، ومتضفش Formik. الدليل في skill `react-hook-form`.

#### 6. `@hookform/resolvers` (^7.0.8)

- **الوظيفة:** جسر بين مكتبات الـ validation و React Hook Form.
- **تفاصيل في المشروع ده:** مستخدم `zodResolver(bookingFormSchema)` في `BookingForm.tsx` — يعني الـ resolver الوحيد المعتمد هو Zod.
- **قاعدة:** متكتبش resolver بإيدك، ومتستخدمش `yupResolver`/`joiResolver` (Yup و Joi مش مثبتين أصلاً).

#### 7. `zod` (^4.6.7 — مشترك بين web و api)

- **الوظيفة:** تعريف الـ schemas والتحقق منها واستنتاج الأنواع.
- **امتى تستخدمه:** schemas الفورم في `pages/bookings/model/booking.ts`، و schemas الـ request body في routes الـ API.
- **تفاصيل في المشروع ده:**
  - استخدم `z.input<typeof schema>` لقيم الفورم الخام و `z.output<typeof schema>` للقيم بعد الـ transform.
  - في Zod 4 استخدم الأساليب الحديثة: `z.email()` و `z.iso.datetime()` و `z.coerce.number()` و `.pipe()` و `.transform()`.
  - نفس الإصدار مثبّت في الطرفين — خلي الأنواع متوافقة بين الفورم والـ API.
- **قاعدة:** متضفش Yup أو Joi أو Valibot، ومتكتبش تحقق يدوي (regex/ if) لما Zod يقدر يعمله. الدليل في skill `zod`.

#### 8. `@tanstack/devtools` + `@tanstack/devtools-vite` + `@tanstack/react-devtools` + `@tanstack/react-query-devtools` + `@tanstack/react-router-devtools`

- **الوظيفة:** لوحة devtools موحّدة تجمع Query و Router في panel واحدة أثناء التطوير.
- **تفاصيل في المشروع ده:**
  - `devtools()` في `vite.config.ts` بيشيل كود الـ devtools من الـ production build.
  - `src/app/providers/app-providers.tsx` بيركّب `TanStackDevtools` مع `ReactQueryDevtoolsPanel` و `TanStackRouterDevtoolsPanel`، وبيظهروا بس لما `import.meta.env.MODE === 'development'`.
- **قاعدة:** متضفش devtools تانية، ومتخليش كود الـ devtools يطلع في production. الدليل في skill `tanstack-devtools`.

### ب) الـ API وقاعدة البيانات — `apps/api`

#### 9. `hono` (^4.13.16)

- **الوظيفة:** إطار العمل الخاص بالـ API: routing و middleware و validation و JSON responses.
- **امتى تستخدمه:** أي route group جديد في `src/features/<name>`، وتركيبه في `src/app.ts` عبر `app.route()`.
- **تفاصيل في المشروع ده:** `app.ts` بيعرّف `AppType = typeof app`، وبي mounting `bookingsRoutes` و `servicesRoutes`.
- **قاعدة:** متستخدمش Express أو Fastify أو Koa، ومتعملش raw Node `http` handlers. الدليل الكامل في skill `hono`.

#### 10. `@hono/node-server` (^2.1.3)

- **الوظيفة:** يسمح بتشغيل تطبيق Hono (`app.fetch`) على Node.
- **تفاصيل في المشروع ده:** مستخدم في `src/index.ts` مع `serve(...)` على الـ port من `PORT` أو 3000.
- **قاعدة:** متستبدلش بـ `@hono/bun` أو `@hono/vercel` إلا لو اتغير هدف النشر.

#### 11. `@hono/zod-validator` (^0.9.1)

- **الوظيفة:** middleware يربط Zod schema بـ Hono عشان يتحقق من الـ request ويخزّن النتيجة في `c.req.valid('json')`.
- **تفاصيل في المشروع ده:** `bookingsRoutes.post('/', zValidator('json', createBookingSchema), ...)` في `features/bookings/index.ts`.
- **قاعدة:** متعملش `schema.parse(await c.req.json())` بإيدك — استخدم الـ middleware عشان الأنواع والـ 422 automatically.

#### 12. `drizzle-orm` (^0.45.4)

- **الوظيفة:** ORM لكتابة الـ schema والاستعلامات بطريقة type-safe.
- **امتى تستخدمه:** تعريف الجداول في `src/db/schema.ts`، واستعلامات `.select()` / `.insert()` مع `.innerJoin()` و `eq()`.
- **تفاصيل في المشروع ده:** بنستخدم الـ adapter `drizzle-orm/neon-http`. الاستعلامات كلها جوه الـ route groups عبر `getDb()`.
- **قاعدة:** متكتبش SQL يدوي بـ `db.execute(raw)` إلا لضرورة، ومتضفش Prisma أو Knex. الدليل في skill `drizzle`.

#### 13. `@neondatabase/serverless` (^1.2.1)

- **الوظيفة:** عميل Neon الرسمي للتعامل مع Postgres عبر HTTP (مناسب للـ serverless).
- **تفاصيل في المشروع ده:** `neon(connectionString)` في `src/db/index.ts` جوه `createDatabase()`، والـ `getDb()` lazy عشان اختبارات الـ routes تشتغل من غير `DATABASE_URL`.
- **قاعدة:** **_server-only** — متستوردش الحزمة دي أو `drizzle-orm` أو أي حاجة من `apps/api/src/db` جوه `apps/web` (ممنوع بـ `no-restricted-imports` في `.oxlintrc.json`). متضفش `pg` أو `postgres.js`. الدليل في skill `neon-postgres`.

#### 14. `drizzle-kit` (^0.31.11 — dev)

- **الوظيفة:** أدوات الـ schema: توليد migrations، تطبيقها، `push`، و `studio`.
- **تفاصيل في المشروع ده:** `drizzle.config.ts` بيشير لـ `src/db/schema.ts` ومخرجاته في `drizzle/`. السكربتات: `db:generate` و `db:migrate` و `db:push` و `db:studio`.
- **قاعدة:** بعد أي تعديل على الـ schema شغّل `npm run db:generate` واعمل commit للـ SQL الناتج. متكتبش ملفات الـ migrations بإيد. الدليل في skill `neon-drizzle`.

### ج) البناء والجودة

#### 15. `vite` (^8.3.6 — dev)

- **الوظيفة:** dev server وبناء الإنتاج لـ `apps/web`.
- **تفاصيل في المشروع ده:** `vite.config.ts` فيه `tanstackRouter()` قبل `react()`، و alias `@` → `./src`، و proxy `/api` → `http://localhost:3000` مع إزالة البادئة (للـ dev بس).
- **قاعدة:** استخدم TypeScript config و ESM دايماً. متضفش Webpack أو Parcel. الدليل في skill `vite`.

#### 16. `@vitejs/plugin-react` (^6.1.2 — dev)

- **الوظيفة:** دعم JSX و Fast Refresh لـ React جوه Vite.
- **قاعدة:** تابع للـ `vite` — متستبدلش بـ `@vitejs/plugin-react-swc` من غير سبب. ترتيب الـ plugins في `vite.config.ts` مهم.

#### 17. `@tanstack/router-plugin` (^1.169.0 — dev)

- **الوظيفة:** يولّد شجرة الـ routes من ملفات `src/app/routes/` ويعمل code splitting.
- **تفاصيل في المشروع ده:** الإعداد في `vite.config.ts`: `target: 'react'`, `autoCodeSplitting: true`، والمخرج `src/app/routeTree.gen.ts`.
- **قاعدة:** متعدّلش `routeTree.gen.ts` بإيد، ومتعملش route تعريف يدوي جنب الـ file-based routing.

#### 18. `typescript` (~7.0.2 في web / ^7.0.2 في api — dev)

- **الوظيفة:** الأنواع والـ typecheck.
- **تفاصيل في المشروع ده:** `npm run build` في web بيشغّل `tsc -b && vite build`، و `npm run typecheck` موجود في الطرفين.
- **قاعدة:** خلي الإصدار متقارب بين الطرفين، واكتب أنواع صريحة على حدود الـ features. متستخدمش `any` كحل سريع.

#### 19. `oxlint` (1.90.0 في web / 1.94.0 في api — dev)

- **الوظيفة:** الـ linter السريع — مستخدم بدل ESLint.
- **تفاصيل في المشروع ده:** كل app ليها `.oxlintrc.json` وسكربت `lint`. ملف `apps/web/.oxlintrc.json` بيمنع استيرادات الـ server في الـ frontend.
- **قاعدة:** متضفش ESLint أو Prettier كـ linter جنبه. الدليل في `AGENTS.md` تحت Import boundaries.

#### 20. `tsx` (^4.23.0 — dev)

- **الوظيفة:** تشغيل ملفات TypeScript مباشرة من غير build.
- **تفاصيل في المشروع ده:** `npm run dev` و `npm run db:seed` في الـ API، و E2E بيشغّل الـ API بـ `--import tsx`.
- **قاعدة:** متستبدلش بـ `ts-node`، ومتكتبش سكربتات JS منفصلة عشان tsx موجود.

#### 21. `dotenv` (^18.0.10 — dev)

- **الوظيفة:** تحميل المتغيرات من `.env` / `.env.test` في `process.env`.
- **تفاصيل في المشروع ده:** `import 'dotenv/config'` في `src/index.ts` و `drizzle.config.ts`. الـ E2E بيستخدم `node --env-file=.env.test` كمان.
- **قاعدة:** `DATABASE_URL` يفضل على جهة الـ API بس، وميتكتبش في الكود أو في `apps/web`.

### د) الاختبارات

#### 22. `vitest` (^5.1.1 — dev، في الطرفين)

- **الوظيفة:** إطار الاختبارات السريع المتوافق مع Vitest API.
- **امتى تستخدمه:** كل اختبارات الوحدة والتكامل في الطرفين (`*.test.ts` / `*.test.tsx`).
- **تفاصيل في المشروع ده:**
  - `apps/web/vitest.config.ts` بيعمل `mergeConfig` مع `vite.config.ts` ويضبط `environment: 'jsdom'` و `setupFiles`.
  - اختبارات الـ API بتعمل mock لـ `getDb()` فمحتاجة `DATABASE_URL`.
- **قاعدة:** متضفش Jest أو Mocha. استخدم `vi.fn()` / `vi.mock()` للـ mocks (Zod و drizzle و الـ fetch). الدليل في skill `vitest`.

#### 23. `@testing-library/react` (^16.3.3 — dev)

- **الوظيفة:** اختبار مكوّنات React من وجهة نظر المستخدم (`render`, `screen`, `userEvent`-style queries).
- **تفاصيل في المشروع ده:** `cleanup()` في `src/test/setup.ts` بعد كل اختبار، مع `window.scrollTo = () => {}` عشان jsdom.
- **قاعدة:** اختبر السلوك مش تفاصيل الـ implementation، ومتستخدمش Enzyme (مش مثبت).

#### 24. `jsdom` (^31.0.1 — dev)

- **الوظيفة:** بيئة DOM وهمية لاختبارات Vitest في الـ web.
- **قاعدة:** تابع لـ Vitest — متستبدلش بـ happy-dom من غير سبب.

#### 25. `@playwright/test` (^1.65.1 — dev)

- **الوظيفة:** اختبارات E2E في المتصفح الحقيقي.
- **تفاصيل في المشروع ده:** `playwright.config.ts` بيشغّل الـ API والـ web تلقائياً (`webServer`) على `.env.test` و port 5173، والاختبارات في `e2e/*.spec.ts` على Chromium.
- **قاعدة:** الـ E2E للـ flow الكامل بس (زي حجز booking). متحولش اختبارات الوحدة لـ Playwright. الدليل في skill `agent-browser` للـ QA اليدوي/الاستكشافي.

### هـ) الأنواع (dev)

#### 26. `@types/react`, `@types/react-dom`, `@types/node`

- **الوظيفة:** تعريفات TypeScript للمكتبات اللي مفيهاش أنواع مدمجة.
- **تفاصيل في المشروع ده:** `@types/node` موجود في الطرفين بإصدارات مختلفة شوية (24 في web / 26 في api) — متقلقش منه طول ما الـ typecheck نافذ.
- **قاعدة:** متضفش `@types/*` لمكتبة بتبعت أنواعها بنفسها (زي Zod و Hono و TanStack).

---

## ربط المكتبات ببنية المشروع ده

زي ما في [`AGENTS.md`](../AGENTS.md): React + Vite في `apps/web`، و Hono API في `apps/api`، و Neon Postgres خلف الـ API.

| جزء المشروع | المكتبات المعتمدة | لا تضيف بديل عنها |
| --- | --- | --- |
| `apps/web` UI | `react`, `react-dom`, `@vitejs/plugin-react` | Preact / Solid / تخصيص DOM |
| `apps/web` routing | `@tanstack/react-router`, `@tanstack/router-plugin` | `react-router-dom` / routing يدوي |
| `apps/web` server state | `@tanstack/react-query` | SWR / Redux / `fetch` في `useEffect` |
| `apps/web` forms | `react-hook-form`, `@hookform/resolvers`, `zod` | Formik / Yup / حالة حقل بـ `useState` |
| `apps/api` | `hono`, `@hono/node-server`, `@hono/zod-validator` | Express / Fastify / تحقق يدوي |
| قاعدة البيانات | `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit` | Prisma / `pg` / SQL يدوي |
| اختبارات الوحدة | `vitest`, `@testing-library/react`, `jsdom` | Jest / Enzyme / happy-dom |
| اختبارات E2E | `@playwright/test` | Cypress / Puppeteer |
| البناء والجودة | `vite`, `typescript`, `oxlint`, `tsx`, `dotenv` | Webpack / ESLint / ts-node |

---

## ملاحظة عن الـ skills

المكتبات والـ skills مرتبطين ببعض: الـ skills بتيجي من `.agents/skills` وموثقة في [`SKILLS.md`](SKILLS.md)، أما الملف ده فهو مرجع **للحزم المثبّتة فعلياً**. مثلاً:

- `tanstack-query` / `tanstack-router` / `vite` / `vitest` / `zod` / `react-hook-form` / `drizzle` → skills بتشرح **كيف** تستخدم المكتبات دي.
- `neon-postgres` / `neon-drizzle` → skills بتشرح إدارة قاعدة البيانات اللي بيوصل لها `@neondatabase/serverless` و `drizzle-kit`.
- `hono` → skill بيشرح إطار العمل المستخدم في `apps/api`.
- `agent-browser` → أداة QA للواجهة، مكمّلة لـ `@playwright/test`.

لو احتجت تتحقق من سلوك أي حزمة، استخدم `opensrc path <package>` (القواعد في [`AGENTS.md`](../AGENTS.md)).
