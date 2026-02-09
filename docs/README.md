# PLI — Guía completa de pantallas, componentes y edición

Documento base para entender qué hace cada parte del sitio y cómo modificarla. Rutas relativas al repo.

## 0. Stack y conceptos
- Next.js 15 (App Router, Turbopack), React 19, TypeScript.
- Autenticación: Clerk (`app/layout.tsx`).
- Backend datos: Prisma + Postgres (`prisma/schema.prisma`, `lib/prisma.ts`).
- Tema: `next-themes` (modo claro/oscuro).
- Estilos: Tailwind v4 (`app/globals.css`).
- i18n propio: cookies `lang` + query `?lang`, diccionarios tipados en `lib/i18n-dict.ts`.
- Asistente: widget global + botón `ChatLauncher`.
- Pagos: Stripe (PaymentIntents + Checkout) y webhook de confirmación (`app/api/stripe/webhook/route.ts`).

## 1. Layouts y routing
- `app/layout.tsx`: raíz. Monta `ClerkProvider`, `I18nProvider` (lee cookie `lang` en SSR) y `ThemeProvider`. En Next 15 es async y usa `await cookies()` para evitar el warning de “sync dynamic APIs”.
- `components/layouts/PublicLayout.tsx`: shell público (NotificationBar + Header + FooterQuote) reutilizado por `app/(pages)/layout.tsx` y `app/cursos/layout.tsx`.
- Rutas principales:
  - Home: `app/(pages)/page.tsx`.
  - Catálogo demo: `app/(courses)/courses-library/page.tsx`.
  - Detalle de curso: `app/cursos/[slug]/page.tsx` (toma datos desde `courseRepository`). En Next 15 es async y usa `await params` para evitar el warning de “sync dynamic APIs”.
  - Chat placeholder: `app/chat/page.tsx`.
  - Auth/panel: `app/(auth)/sign-in/page.tsx` (Clerk), `app/(pages)/customer/page.tsx`, `app/panel/page.tsx`, `app/search/page.tsx`.
- Verificación SMS: `app/(pages)/verify-phone/page.tsx` (pantalla para verificar teléfono en Clerk).
  - Se abre automáticamente si el backend detecta que falta verificación SMS para `new-student`.
  - Soporta `?return=/ruta` (solo paths internos) y al verificar redirige a esa ruta.
  - En el flujo de cursos se usa `return=/cursos/[slug]?enroll=1&step=2` para volver al paso de datos.

## 2. Datos y fuentes
- Home demo: `constants/home-content.ts` (cursos y testimonios). Tipos en `types/home.ts`.
- Cursos demo: `constants/courses.ts` (incluye `demoCourses` con schedule, enrollment, instructores).
- Repositorio de cursos: `lib/courses-repository.ts` (capa para cambiar a CMS/DB sin tocar las páginas).
- Backend usuarios/compras: `prisma/schema.prisma` + `lib/users.ts` + `lib/clerk-users.ts`.
- i18n:
  - Diccionarios en `lib/i18n-dict.ts` (claves tipadas, `Locale`).
  - Cliente: `lib/i18n.tsx` (`useI18n`, sincroniza cookie y query).
  - Servidor: `lib/i18n-server.ts` (`tServer`, usa cookie en SSR).
  - Selector: `components/front/ui/LanguageSwitcher.tsx`.

## 3. Componentes clave (UI pública)
- Header/nav: `components/front/Header.tsx`, `HeaderActions.tsx` (CTA login, idioma).
- Barra aviso: `components/front/ui/NotificationBar.tsx` (countdown; usa `t("notif_announcement")`, acepta prop `message`).
- Home:
  - Hero: `HeroHome.tsx` (textos i18n), `VerticalCarousel.tsx` (usa hooks `useMediaQuery`, `useThemeObserver`), `CheckBoxInput.tsx`.
  - Cursos: `CoursesMasonry.tsx` (grid filtrable; recibe `courses`, `categories`, `renderCard` opcional).
  - Testimonios: `ReviewsSlider.tsx` (no renderiza si `slides` vacío).
  - Banners: `CreatorsBanner`, `SalsaEventsBanner`, `ClassPricing`, `JourneyCtaBanner`, `InspirationShowcase`, etc.
- Asistente: `components/front/AssistantWidget*.tsx`, `ChatLauncher.tsx` (dispara evento `assistant:open` y puede prefetchar `/chat`).

## 4. Cursos — página de detalle
- Contenedor: `components/front/courses/CoursePageClient.tsx` (3 columnas; arma DTOs reducidos).
- Columna izquierda: `CourseAsideLeft.tsx` (hero, horario, beneficios, instructores) con `CourseOverviewData`.
- Columna central: `CourseSections.tsx` (descripción, requisitos, syllabus, horarios) con `CourseSectionsData`.
- Columna derecha: `CourseAsideRight.tsx` (CTA inscripción + chat) con `CourseEnrollmentData`.
- Modal inscripción: `EnrollModal.tsx` (flujo multi-paso, genera links de calendario, textos i18n, usa `ChatLauncher`).
  - Auto‑open: `?enroll=1` y `?step=2` reabren el modal en el paso indicado.

## 4.1 Perfil del alumno (Client Profile)
- Ruta: `/client-profile` → `app/client-profile/page.tsx`.
- UI principal: `components/front/profile/ProfilePageClient.tsx` (3 columnas: perfil/analytics/booking).
- Datos del alumno:
  - Identidad base desde Clerk (`useUser`).
  - Campos extendidos en Postgres: `StudentProfile` (cumpleaños + contacto de emergencia).
  - Lectura/escritura con `/api/profile` (GET/PUT).
- Avatar:
  - Se actualiza desde el perfil con `/api/profile/avatar`.
  - Usa Clerk `updateUserProfileImage` para persistir.
  - Si hay proveedor social (Google), se usa su `imageUrl` como fallback.
- Puntos (PLI Coins):
  - Ledger en `PointsLedger` (acumulación histórica).
  - Al completar perfil se otorgan puntos automáticos.
  - En UI se muestra `pointsBalance` y progreso hacia meta.

## 5. Ediciones rápidas (qué tocar)
- Barra de aviso: `notif_announcement` en `lib/i18n-dict.ts` o pasa `message` a `NotificationBar`.
- Cursos home: `homeCourses` y `homeCourseCategories` en `constants/home-content.ts`.
- Testimonios: `homeReviewSlides` en `constants/home-content.ts`.
- Cursos detalle: `demoCourses` en `constants/courses.ts` (vía `courseRepository`).
- Hero/inputs: `HeroHome.tsx`, `CheckBoxInput.tsx`, `VerticalCarousel.tsx`.
- Estilos globales: `app/globals.css`.

## 6. Ejemplos de edición (paso a paso)

### Agregar un curso al detalle (rutas /cursos/[slug])
1) Abre `constants/courses.ts` y agrega un objeto a `demoCourses` con campos mínimos:
   - `slug` (único), `title`, `description`, `level`, `duration`.
   - `schedule` (day, time, starts, frequency opcional).
   - `location` (address, mapUrl opcional).
   - `instructors` (name, role?, photo?).
   - `enrollment` (services[], packages[], addons?[] con `id`, `label`, `price?`).
   - `heroMedia.image` apuntando a `public/images/...`.
2) No cambies rutas: `app/cursos/[slug]/page.tsx` usa `courseRepository.getAllCourseSlugs()` para generar params.
3) Opcional: `benefits`, `syllabus` se muestran en left/center si existen.

### Agregar un curso a la home
1) Edita `constants/home-content.ts` → `homeCourses`:
   - Campos: `id` único, `title`, `teacher`, `image`, `category`, `students?`, `duration?`, `badge?`, `size?`, `description?`, `slug?`.
2) Si la categoría es nueva, agrégala a `homeCourseCategories` para que el filtro la liste.
3) Si defines `slug`, la tarjeta linkea a `/cursos/[slug]#enroll-cta` (asegúrate de que exista en `constants/courses.ts`).

### Agregar un testimonio
1) `constants/home-content.ts` → `homeReviewSlides`: agrega `image`, `text`, `author`, `role?`.
2) Si dejas el array vacío, `ReviewsSlider` no se renderiza.

### Agregar un idioma nuevo
1) `lib/i18n-dict.ts`: agrega una clave en `translations` (ej. `fr: { ... }`) con todas las cadenas.
2) Incluye el nuevo código en `type Locale`.
3) `I18nProvider` y `LanguageSwitcher` ya respetan `?lang=` y cookie `lang`; al agregar el código, el toggle lo usará.

### Cambiar texto de la barra de aviso
1) `lib/i18n-dict.ts`: edita `notif_announcement` en los idiomas activos.
2) O pasa `<NotificationBar message="Texto fijo" />` desde `app/(pages)/layout.tsx` o `app/cursos/layout.tsx`.

### Ajustar Hero de la home
1) Textos: `hero_title`, `hero_subtitle`, `hero_question` en `lib/i18n-dict.ts`.
2) Imágenes del carrusel: `defaultImages` en `components/front/ui/VerticalCarousel.tsx` o pasa `images` como prop desde `HeroHome`.
3) Checkboxes: array `intentions` en `CheckBoxInput.tsx`.

### Editar UI de inscripción (EnrollModal)
1) Las opciones provienen de `course.enrollment` en `constants/courses.ts`.
2) Textos de pasos/botones: claves `step_*`, `payments_*`, `label_*` en `lib/i18n-dict.ts`.
3) Para backend real, `handleSubmit` ya hace `fetch` a `/api/checkout/intent`; puedes extender el `payload` si agregas nuevos campos en el backend.
4) Si agregas nuevos datos de usuario, envíalos desde `EnrollModal.tsx` y asegúrate de mapearlos en `app/api/checkout/intent/route.ts`.
5) Para volver al modal tras verificar SMS, usa `?enroll=1&step=2` en la URL del curso.

### Cambiar la fuente de datos de cursos (CMS/DB)
1) Implementa tu cliente en `lib/courses-repository.ts` cumpliendo `CourseRepository` (`getCourseBySlug`, `getAllCourseSlugs`).
2) Exporta tu implementación (en lugar de la in-memory).
3) Verifica que `getAllCourseSlugs()` devuelva slugs válidos para el SSG/SSR de `app/cursos/[slug]/page.tsx`.

### Añadir imágenes nuevas
1) Sube el archivo a `public/images/...`.
2) Actualiza rutas en `constants/home-content.ts` (home) o `constants/courses.ts` (`heroMedia.image`, `instructors.photo`).
3) Las cards usan `next/image` con `fill`; preferible proporción 3:4 o 4:3.

## 7. Flujo de i18n y SSR (evitar hydration mismatch)
- SSR: `app/layout.tsx` lee cookie `lang` y pasa `initialLocale` al `I18nProvider`.
- Cliente: `I18nProvider` sincroniza con `?lang` y persiste cookie.
- Mantén las claves idénticas en todos los idiomas y evita valores no deterministas en SSR (Date.now, Math.random).

## 8. Asistente y chat
- Widget global: `AssistantWidgetMountI18n` se monta en `app/layout.tsx`.
- Botón para abrir: `components/front/ui/ChatLauncher.tsx` dispara `window.dispatchEvent("assistant:open")` y puede navegar/prefetchar `/chat`.
- Página placeholder `/chat`: `app/chat/page.tsx` lista los pasos para integrar Vercel AI SDK (`useChat` + endpoint `/api/chat`).

## 9. Comandos y pruebas rápidas
- Dev: `npm run dev` (Turbopack).
- Lint: `npm run lint`.
- Build/SSR: `npm run build`.
- Start: `npm start` (sobre build).
- Unit tests: `npm run test` (Vitest).
- Coverage: `npm run test:coverage`.
- E2E (Playwright): `npm run test:e2e` (requiere `npx playwright install`).
  - En Apple Silicon se usa el wrapper `scripts/run-playwright.mjs` para forzar `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac-arm64`.
- Probar i18n: añade `?lang=es` o `?lang=en` y revisa cookie `lang`.
- Prisma:
  - Migrar DB: `npx prisma migrate dev --name init`.
  - Generar cliente: `npx prisma generate`.
  - Script: `npm run prisma:generate` (se ejecuta también en `postinstall`).
  - Explorar datos: `npx prisma studio`.
  - Nota: Prisma CLI carga `.env` por defecto, no `.env.local`. Para Railway local, pon `DATABASE_URL` en `.env` con `sslmode=require`.

### 9.1 Cobertura de tests (qué valida cada uno)
- `tests/phone.test.ts`: normalización y formato de teléfonos de EE. UU. (E164 y display), casos válidos e inválidos.
- `tests/checkout.test.ts`: validación pura de payload (email, teléfono, participantes, servicio) y reglas de clamping/errores.
- `tests/api/checkout-intent.test.ts`: ruta `/api/checkout/intent` con payload mínimo, respuesta `clientSecret` y manejo de errores esperados.
- `tests/api/checkout-session.test.ts`: ruta `/api/checkout/session`, creación de sesión y URL de Stripe con validaciones base.
- `tests/profile-utils.test.ts`: utilidades del perfil (fecha, % de completado, prefill para booking).
- `tests/api/profile.test.ts`: `/api/profile` (GET/PUT), sincronización con Clerk, puntos y perfil completo.
- `tests/api/profile-avatar.test.ts`: `/api/profile/avatar`, validación de archivo y guardado del avatar en Clerk.
- `e2e/course-flow.spec.ts`: flujo completo del modal de inscripción, persistencia de draft, selección de Stripe y apertura del modal de pago.
- `e2e/profile.spec.ts`: render de perfil del alumno, toggle del formulario y apertura del selector de cursos.

### 9.2 Cómo correr tests puntuales
- Unit test específico:
  - `npm run test -- tests/phone.test.ts`
  - `npm run test -- tests/checkout.test.ts`
  - `npm run test -- tests/api/checkout-intent.test.ts`
  - `npm run test -- tests/api/checkout-session.test.ts`
  - `npm run test -- tests/api/profile.test.ts`
  - `npm run test -- tests/api/profile-avatar.test.ts`
- E2E específico:
  - `npx playwright test e2e/course-flow.spec.ts`
  - `npx playwright test e2e/profile.spec.ts`
  - `npx playwright test e2e/course-flow.spec.ts:20`

### 9.3 Tests recomendados antes de deploy
- Unit/Api: `npm run test`
- E2E crítico: `npm run test:e2e`
- (Opcional) Lint: `npm run lint`

## 10. Dónde mirar según tarea
- **Cambiar copy global**: `lib/i18n-dict.ts`.
- **Actualizar contenido home**: `constants/home-content.ts` + `components/front/ui/*`.
- **Cursos y reservas**: `constants/courses.ts`, `lib/courses-repository.ts`, `components/front/courses/*`.
- **Estilos/theme**: `app/globals.css`, `ThemeProvider` en `app/layout.tsx`.
- **Asistente/CTA**: `AssistantWidget*`, `ChatLauncher`.
- **Usuarios y compras**: `app/api/checkout/*`, `app/api/stripe/webhook/route.ts`, `lib/users.ts`, `lib/clerk-users.ts`, `prisma/schema.prisma`.

## 11. Backend — usuarios y compras (Clerk + Stripe + Prisma)

### 11.1 Objetivo del flujo
- Unificar usuarios entre Clerk y Postgres, incluso si compran como invitados.
- Guardar compras confirmadas por Stripe y asociarlas al usuario correcto.
- Permitir que un usuario se cree en Clerk antes de pagar (con los datos del formulario).

### 11.2 Estructura de datos (Prisma)
- `prisma/schema.prisma`:
  - `User`: guarda `clerkId`, `email`, `name`, `phone`, `stripeCustomerId`.
  - `Purchase`: guarda `courseSlug`, `amount`, `status`, ids de Stripe y metadata.
- Si agregas nuevos campos, actualiza:
  - `prisma/schema.prisma`
  - `app/api/stripe/webhook/route.ts` (mapeo a DB)
  - `lib/users.ts` o `lib/clerk-users.ts` si aplica

### 11.3 Creación/merge de usuarios (Clerk → DB)
- `lib/clerk-users.ts`:
  - `ensureClerkUser` crea o busca un usuario en Clerk por email.
  - Si hay `firstName/lastName` o `name`, los usa al crear.
  - `updateClerkUserIfMissing` completa datos faltantes (nombre/teléfono) cuando ya existe.
  - Se usa en checkout para crear el usuario **antes** del pago.
- `lib/users.ts`:
  - `upsertUserByIdentifiers` busca por `clerkId`/email y actualiza o crea en Postgres.
- `app/api/users/sync/route.ts`:
  - Endpoint para sincronizar el usuario logueado con Clerk hacia Postgres.
  - Útil para tener el usuario en DB incluso sin compras.
  - Acepta body opcional con `firstName`, `lastName`, `name`, `phone` para completar datos en Clerk fuera del checkout.

### 11.4 Inicio de pago (pre‑Stripe)
- `app/api/checkout/intent/route.ts`:
  - Crea PaymentIntent.
  - Si el usuario **no** está logueado, crea o busca usuario en Clerk con email/nombre/teléfono.
  - Si el usuario **está** logueado, intenta completar nombre/teléfono faltante en Clerk.
  - `auth()` es async en Next 15: siempre usar `await auth()` en rutas API.
  - Si el header trae `Authorization: Bearer <token>`, se intenta validar con `verifyToken` para rescatar el `userId`.
  - Requiere `email` válido y `phone` obligatorio (mínimo 6 dígitos).
  - Si el servicio es `new-student`, valida que no existan compras previas por email/teléfono/Clerk.
  - Para `new-student`, exige teléfono **verificado por SMS** en Clerk.
  - Para `new-student`, limita la compra a **1 participante**.
  - Guarda el `clerkId` en metadata (`userId`) para resolverlo en el webhook.
  - Si el email/teléfono ya existe en Clerk y el usuario no está logueado, devuelve error `ACCOUNT_EXISTS` para forzar login.
- `app/api/checkout/session/route.ts`:
  - Crea Checkout Session (mismo patrón que PaymentIntent).
  - Usa `client_reference_id` para asociar la sesión con el usuario.
  - También completa datos faltantes en Clerk si el usuario está logueado.
  - `auth()` es async en Next 15: siempre usar `await auth()` en rutas API.
  - Si el header trae `Authorization: Bearer <token>`, se intenta validar con `verifyToken` para rescatar el `userId`.
  - Misma validación de `phone` y guard de `new-student` que el intent.
  - Requiere teléfono verificado por SMS en `new-student`.
  - Bloquea checkout si detecta cuenta existente y el usuario está deslogueado (`ACCOUNT_EXISTS`).

### 11.5 Confirmación de pago (Stripe Webhook)
- `app/api/stripe/webhook/route.ts`:
  - Verifica firma Stripe con `STRIPE_WEBHOOK_SECRET`.
  - En `checkout.session.completed` o `payment_intent.succeeded`:
    - Resuelve el usuario (por `clerkId` o email).
    - Crea/actualiza `Purchase` en Postgres.
    - Si el usuario compra como invitado, queda asociado por email.
  - En local necesitas Stripe CLI:
    - `stripe login`
    - `stripe listen --forward-to http://localhost:3000/api/stripe/webhook`
    - Copia el `whsec_...` y guárdalo en `.env.local` como `STRIPE_WEBHOOK_SECRET`

### 11.6 Cómo editar este backend
- Cambiar los campos guardados en compras:
  - Actualiza `prisma/schema.prisma` y vuelve a migrar.
  - Edita el mapeo en `app/api/stripe/webhook/route.ts`.
- Cambiar cómo se crea el usuario en Clerk:
  - Edita `lib/clerk-users.ts`.
  - Si quieres agregar validaciones, hazlo en `app/api/checkout/intent/route.ts` y `app/api/checkout/session/route.ts`.
- Cambiar los datos enviados al pago:
  - Frontend: `components/front/courses/EnrollModal.tsx`.
  - Backend: `app/api/checkout/intent/route.ts`.

### 11.7 Variables de entorno necesarias
- `DATABASE_URL` (Postgres).
  - Para Railway local: usa el Public URL con `?sslmode=require` en `.env`.
  - Para Railway en deploy: usa el Internal URL (`railway.internal`) como variable en el panel.
- `STRIPE_SECRET_KEY` y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- `STRIPE_WEBHOOK_SECRET` (para validar webhooks).
  - Se obtiene con Stripe CLI (`stripe listen`) o desde el Dashboard al crear el webhook.
- `CLERK_SECRET_KEY` y `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- `NEXT_PUBLIC_SITE_URL` (para URLs de éxito/cancelación en Checkout).

### 11.8 Seguridad y anti‑abuso (recomendaciones)
- **Regla de “new student”**: el backend bloquea la tarifa `new-student` si hay compras previas por `email`, `phone` o `clerkId`.
- **Teléfono obligatorio**: el backend rechaza pagos sin teléfono válido.
- **SMS verificado**: el precio `new-student` requiere teléfono verificado en Clerk.
- **1 persona por new‑student**: si quieren descuento para otra persona, debe crear su propia reserva.
- **Sugerido para más seguridad**:
  - Forzar que el usuario esté logueado antes de permitir `new-student`.
  - Exigir **verificación SMS** en Clerk para habilitar el precio `new-student`.
  - Normalizar teléfonos históricos (backfill) si hay compras viejas con formatos distintos.

### 11.9 Pantalla de verificación de teléfono
- Ruta: `app/(pages)/verify-phone/page.tsx`.
- Usa `<UserProfile />` de Clerk con `__experimental_startPath="/account"` y oculta la navegación para enfocar el panel de teléfono.
- Si el backend devuelve “Phone verification required”, el modal redirige automáticamente a esta pantalla.
- Si el backend devuelve `ACCOUNT_EXISTS`, el modal muestra un botón de login que vuelve al paso de datos.
- Soporta `?return=/ruta` (solo paths internos). Si el teléfono ya está verificado o se verifica, redirige a esa ruta.

## 12. Registro detallado de cambios (checkout + Clerk + Prisma + Railway)

### 12.1 Flujo actual (paso a paso)
1. El usuario abre `/cursos/[slug]`. Si la URL trae `?enroll=1`, el modal se abre desde `CourseAsideRight.tsx`.
2. En `EnrollModal.tsx` se completan los pasos. El teléfono siempre se formatea a US (`+1 (XXX) XXX-XXXX`) y se valida antes de continuar.
3. Al confirmar Stripe, el modal llama a `/api/checkout/intent` con `Authorization: Bearer <token>` si el usuario está logueado.
4. El backend valida precio, servicio y addons. Si es `new-student`, exige 1 participante, teléfono verificado y ausencia de compras previas. Si ya es alumno, responde `NEW_STUDENT_ALREADY` y el modal muestra un mensaje amable + vuelve al paso de servicio.
5. Si el usuario no está logueado y el email/teléfono ya existen en Clerk, el backend responde `ACCOUNT_EXISTS` y el modal muestra un login embebido (popup).
6. Si falta verificación SMS para `new-student`, el backend responde error y el frontend redirige a `/verify-phone?return=/cursos/[slug]?enroll=1&step=2`.
7. Con validaciones OK, se crea el PaymentIntent y se abre `StripePaymentModal` con el `clientSecret`.
8. El webhook de Stripe confirma el pago y crea la `Purchase` en Postgres.
9. El modal guarda un draft en `sessionStorage` para evitar perder datos al volver del login o verificación.

### 12.2 Archivos modificados y propósito
- `components/front/courses/EnrollModal.tsx`: flujo multi‑paso, validaciones, formato de teléfono US, draft en `sessionStorage`, popup de login con Clerk, auto‑retry del pago después del login y redirección a verificación SMS.
- `components/front/courses/hooks/useEnrollDraft.ts`: hook que centraliza guardar/restaurar el draft en `sessionStorage`.
- `components/front/courses/utils/phone.ts`: helpers puros para formateo/validación de teléfono US.
- `components/front/courses/CourseAsideRight.tsx`: abre automáticamente el modal si `?enroll=1` y permite volver a un paso específico con `?step=`.
- `components/front/profile/profile-utils.ts`: helpers puros del perfil (fecha, % completado, prefill).
- `app/(pages)/verify-phone/page.tsx`: pantalla de verificación SMS. Redirige de vuelta al flujo si el teléfono ya está verificado.
- `app/(auth)/sign-in/page.tsx`: login standalone con `routing="hash"` para evitar errores en rutas no catch‑all.
- `app/api/checkout/intent/route.ts`: crea PaymentIntent, maneja creación/merge de usuario en Clerk, valida `new-student`, bloquea cuentas existentes con `ACCOUNT_EXISTS` y usa `await auth()`.
- `app/api/checkout/session/route.ts`: Checkout Session con las mismas reglas y validaciones que `intent`.
- `app/api/users/sync/route.ts`: sincroniza el usuario logueado en Postgres y usa `await auth()`.
- `lib/clerk-users.ts`: helpers para buscar/crear usuario en Clerk y completar datos faltantes (Clerk v6 con `await clerkClient()`).
- `lib/checkout.ts`: helpers reutilizables para validaciones de checkout y resolución de usuario.
- `tests/*`: tests unitarios (Vitest) y de rutas API con mocks.
- `e2e/*`: tests E2E básicos con Playwright.
- `vitest.config.ts`, `playwright.config.ts`: configuración de testing.
- `app/layout.tsx`: ahora es async y usa `await cookies()` para evitar el warning de Next 15.
- `app/cursos/[slug]/page.tsx`: ahora es async y usa `await params` para evitar el warning de Next 15.
- `lib/i18n-dict.ts`: nuevas cadenas para login embebido, errores de cuenta existente y verificación de teléfono. Incluye `new_student_existing_error` (mensaje humorístico para alumnos existentes).
- `.env` y `.env.local`: `DATABASE_URL` para Prisma (Railway). Prisma CLI lee `.env`, no `.env.local`.

### 12.3 Railway + Prisma (paso a paso de setup)
1. Crear el Postgres en Railway y copiar el Public URL.
2. En local, poner `DATABASE_URL` en `.env` con `?sslmode=require`.
3. Ejecutar `npx prisma migrate dev --name init` y `npx prisma generate`.
4. En Railway (deploy), configurar `DATABASE_URL` con el Internal URL (`railway.internal`).
5. Si `migrate dev` falla por shadow DB, usar `npx prisma migrate dev --name init --create-only` y luego `npx prisma migrate deploy`.
6. Para registrar pagos localmente, levantar el webhook con Stripe CLI y setear `STRIPE_WEBHOOK_SECRET` en `.env.local`.
