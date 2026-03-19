# PLI — Plataforma de cursos (Next.js)

App Next 15 (Turbopack) con React 19 y TypeScript. Autenticación con Clerk, theming con `next-themes`, i18n propio (EN/ES), UI Tailwind v4 y un widget de asistente.

## Comandos
- `npm run dev` — desarrollo con Turbopack.
- `npm run lint` — ESLint.
- `npm run build` — build/SSR.
- `npm start` — arranca el build.
- `npm run prisma:generate` — regenera Prisma Client.
- `npm run test` — unit tests (Vitest).
- `npm run test:e2e` — Playwright.

## Estructura rápida
- Layout raíz: `app/layout.tsx` (Clerk, I18n, Theme + widget).
- Páginas públicas: `app/(pages)/layout.tsx` con `NotificationBar`, `Header`, `FooterQuote`.
- Home: `app/(pages)/page.tsx` (usa `constants/home-content.ts` para cursos y testimonios).
- Cursos: catálogo `app/(courses)/courses-library/page.tsx`; detalle dinámico `app/cursos/[slug]/page.tsx` usando `lib/courses-repository.ts` (fuente actual `constants/courses.ts`).
- Componentes UI: `components/front/` y `components/front/ui/` (hero, masonry, sliders, asistente).
- Hooks utilitarios: `lib/hooks/useMediaQuery.ts`, `lib/hooks/useThemeObserver.ts`.
- i18n: diccionarios en `lib/i18n-dict.ts`, cliente `lib/i18n.tsx`, server `lib/i18n-server.ts`.

## Backend (usuarios y pagos)
- Usuarios: creación/sync con Clerk en `app/api/checkout/*` y `app/api/users/sync`.
- Seguridad “new student”: teléfono obligatorio + SMS verificado, 1 participante, bloqueo si hay compras previas por email/teléfono/Clerk.
- Compras: webhook de Stripe en `app/api/stripe/webhook/route.ts` guarda en Postgres (`prisma/schema.prisma`).
- Verificación SMS: pantalla `/verify-phone` con retorno a la acción previa usando `?return=/ruta` (ver detalles en `docs/README.md`).
- Reports IA (preparado para integración): `POST /api/staff/reports/suggestions` con proveedor `mock` o `custom-http` por env.

## Variables opcionales (IA reports)
- `AI_REPORTS_PROVIDER`: `mock` (default) o `custom-http`.
- `AI_REPORTS_AGENT_URL`: URL del endpoint externo del agente (si usas `custom-http`).
- `AI_REPORTS_AGENT_TOKEN`: bearer token opcional para autenticar contra el endpoint externo.

## Edición de contenido
- Cursos/home y testimonios: `constants/home-content.ts`.
- Cursos demo (detalle): `constants/courses.ts` (acceso vía `lib/courses-repository.ts`).
- Textos traducidos (incluida la barra de aviso): `lib/i18n-dict.ts`.
- Hero y bloques iniciales: `components/front/ui/HeroHome.tsx`, `CheckBoxInput.tsx`, `VerticalCarousel.tsx`.
- CTA/chat: `components/front/ui/ChatLauncher.tsx`, `components/front/AssistantWidget*.tsx`.

## Documentación
- Guía base de arquitectura y edición: `docs/README.md`
- Matriz de tests: `docs/TESTS.md`
- Flujo QR check-in: `docs/CHECKIN_QR.md`
- Módulo Staff portal: `docs/STAFF_PORTAL.md`
- Smoke checklist para demo en Vercel: `docs/SMOKE_DEMO_VERCEL.md`

## Ejemplos rápidos
- Nuevo curso (detalle): agrega a `demoCourses` en `constants/courses.ts`; el route `/cursos/[slug]` se genera solo por `courseRepository`.
- Nuevo curso en home: edita `homeCourses` y `homeCourseCategories` en `constants/home-content.ts`.
- Nuevo testimonio: añade a `homeReviewSlides` en `constants/home-content.ts`.
- Nuevo idioma: agrega la entrada en `lib/i18n-dict.ts`, incluye el código en `Locale` y listo; el cookie/query `lang` lo activará.

Para más pasos detallados (cambiar textos de la barra de aviso, editar hero, integrar inscripciones), ver `docs/README.md`.
