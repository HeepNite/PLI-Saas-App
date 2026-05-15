# PLI — Palladium Latin Institute

> Plataforma SaaS para escuelas de arte y danza. Gestión de alumnos, staff, asistencia, pagos, kiosk y más.

Built with **Next.js 15** · **React 19** · **TypeScript** · **Tailwind CSS v4** · **Prisma** · **PostgreSQL** · **Clerk** · **Stripe**

---

## Demo Local

Si querés ver el sistema funcionando sin configurar el entorno de desarrollo completo, tenemos una rama de demo lista para usar.

> **[Ver guía de instalación del demo (DEMO.md)](./DEMO.md)**

La rama `demo/es-local` incluye:
- Base de datos local con datos de demostración en español
- Portal de staff, kiosk y perfil del cliente funcionales
- Setup automático con un solo comando

```bash
git clone https://github.com/HeepNite/PLI-Saas-App.git
cd PLI-Saas-App
git checkout demo/es-local
```

Seguí los pasos en [DEMO.md](./DEMO.md) para tenerlo corriendo en minutos.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Lenguaje | TypeScript (strict mode) |
| Base de datos | PostgreSQL via Prisma ORM |
| Autenticación | Clerk |
| Pagos | Stripe |
| Animaciones | Framer Motion, Lenis (smooth scroll) |
| i18n | Implementación custom (EN/ES) |
| Testing | Vitest (unit/integration), Playwright (E2E) |

---

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo local |
| `npm run dev:turbo` | Desarrollo con Turbopack |
| `npm run build` | Build de producción |
| `npm start` | Arranca el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificación de tipos |
| `npm run prisma:generate` | Regenera Prisma Client |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:e2e` | Tests E2E (Playwright) |

---

## Estructura del Proyecto

```
app/
├── (pages)/          # Páginas públicas (landing, catálogo)
├── (courses)/        # Biblioteca de cursos
├── (auth)/           # Sign-in / Sign-up (Clerk)
├── courses/[slug]    # Detalle de curso público
├── staff/            # Portal staff, kiosk, admin
├── client-profile/   # Perfil del alumno/cliente
├── checkin/          # QR check-in
├── api/              # API routes (staff, checkout, stripe, clerk)
└── layout.tsx        # Layout raíz (Clerk, I18n, Theme)

components/
├── front/            # Componentes del sitio público
│   ├── staff/        # Componentes del portal staff
│   └── ui/           # Componentes UI reutilizables
└── ui/               # shadcn/ui components

lib/
├── i18n.tsx          # Provider i18n (cliente)
├── i18n-server.ts    # i18n server-side
├── i18n-dict.ts      # Diccionarios de traducciones
├── prisma.ts         # Instancia de Prisma
├── security/         # Auth helpers (staff PIN, terminal, student PIN)
└── hooks/            # Custom hooks

prisma/
├── schema.prisma     # Schema de la base de datos
└── seed.ts           # Seed de datos base

docs/
├── specs/            # Especificaciones de features
├── system/           # Documentación de referencia
└── Prompts/          # Scaffolding de prompts
```

---

## Backend

### Usuarios y autenticación
- Sync con Clerk: `app/api/checkout/*` y `app/api/users/sync`
- Seguridad "new student": teléfono obligatorio + SMS verificado, bloqueo si hay compras previas
- Verificación SMS: `/verify-phone` con retorno a la acción previa (`?return=/ruta`)

### Pagos
- Webhook de Stripe: `app/api/stripe/webhook/route.ts`
- Persistencia en PostgreSQL via Prisma

### Staff Portal
- Gestión de alumnos, asistencia, payroll
- Sistema de kiosk con terminales y PINs
- Gestión de salas y reservas
- Sistema de puntos y paquetes

### IA Reports (preparado)
- `POST /api/staff/reports/suggestions`
- Provider `mock` (default) o `custom-http` por env

---

## Variables de Entorno

### Requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string de PostgreSQL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Key pública de Clerk |
| `CLERK_SECRET_KEY` | Key secreta de Clerk |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Key pública de Stripe |
| `STRIPE_SECRET_KEY` | Key secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook de Stripe |
| `NEXT_PUBLIC_SITE_URL` | URL del sitio |
| `STAFF_CHECKIN_TOKEN` | Token para check-in de staff |

### Opcionales (IA Reports)

| Variable | Descripción |
|----------|-------------|
| `AI_REPORTS_PROVIDER` | `mock` (default) o `custom-http` |
| `AI_REPORTS_AGENT_URL` | URL del endpoint externo |
| `AI_REPORTS_AGENT_TOKEN` | Bearer token para el endpoint |

---

## Edición de Contenido

| Qué cambiar | Dónde |
|-------------|-------|
| Cursos y testimonios del home | `constants/home-content.ts` |
| Cursos demo (detalle) | `constants/courses.ts` |
| Textos traducidos | `lib/i18n-dict.ts` |
| Hero y bloques iniciales | `components/front/ui/HeroHome.tsx` |
| Widget de asistente | `components/front/AssistantWidget*.tsx` |

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/README.md](./docs/README.md) | Arquitectura y guía de edición |
| [docs/system/TESTS.md](./docs/system/TESTS.md) | Matriz de tests |
| [docs/system/CHECKIN_QR.md](./docs/system/CHECKIN_QR.md) | Flujo QR check-in |
| [docs/system/STAFF_PORTAL.md](./docs/system/STAFF_PORTAL.md) | Módulo Staff portal |
| [DEMO.md](./DEMO.md) | Guía del demo local |
