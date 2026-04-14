# SDD: Refactor Security/Auth Layer + Extract Shared Utilities

> Plan completo para ejecutar con Codex/opencode. Generado 2026-04-11.

## Reglas de Ejecucion

1. ZERO cambios de logica de negocio — solo reorganizacion estructural
2. Despues de CADA tarea correr `npx vitest run` — si falla, arreglar antes de seguir
3. Hacer un commit por tarea con formato: `refactor(security): T01 — extract shared asObject utility`
4. NO modificar tests existentes salvo imports rotos
5. Cuando una tarea dice "buscar con rg", hacerlo — puede haber copias que no estan listadas
6. El barrel re-export en student-pin.ts (T12) es CRITICO: los 9 consumidores existentes NO deben cambiar sus imports
7. En T03 (normalizePhone) LEER las 4 variantes antes de unificar — si difieren, usar la mas permisiva
8. En T05 (staff-pin) la version canonica de isValidPinHash usa timingSafeEqual, NO comparacion plana

## Orden de Ejecucion

```
Bloque A (paralelas): T01, T02, T03, T04
Bloque B: T05
Bloque C: T06
Bloque D (secuencial): T07 → T08 → T09 → T12
Bloque E: T10, T11
Bloque F: T13
```

### Grafo de Dependencias

```
T01 ─┐
T02 ─┤
T03 ─┼── (paralelas) ──→ T13
T04 ─┤
T05 ─┤
T06 ─┤
T10 ─┤
T11 ─┘

T07 → T08 → T09 → T12 → T13
```

## Target Architecture

### Nuevos modulos compartidos

| Archivo | Contenido |
|---------|-----------|
| `lib/shared/as-object.ts` | `asObject()` — reemplaza 15 copias |
| `lib/shared/normalize.ts` | `normalizeString()`, `normalizePhoneDigits()` — reemplaza 7+ copias |
| `lib/shared/normalize-phone.ts` | `normalizePhone()` — reemplaza 4 copias |
| `lib/shared/timezone.ts` | `NY_TIMEZONE` constant — reemplaza 10+ strings hardcodeados |

### Nuevos modulos de seguridad

| Archivo | Contenido |
|---------|-----------|
| `lib/security/staff-pin.ts` | `hashPin()`, `isValidPinHash()` (timing-safe), `isValidPinFormat()` — SHA-256 para staff |
| `lib/security/staff-auth-shared.ts` | `parseSessionIssuedAtMs()`, `parseForcedLogoutAtMs()`, `parseDbRole()`, `STAFF_ROLE_SET` |
| `lib/security/student-pin-crypto.ts` | Argon2 hashing, HMAC digest, pepper, format validation |
| `lib/security/student-pin-lifecycle.ts` | Types, constants, error class, predicados puros |
| `lib/security/student-pin-repository.ts` | 18 funciones async de DB |
| `lib/staff/payment-types.ts` | `StaffPaymentInfo`, `StaffPaymentPreference` — sacados de `staff-category.ts` |

### Barrel re-export

`student-pin.ts` se convierte en barrel file que re-exporta todo → zero cambios de imports en consumidores.

## Tareas

### BLOQUE A — Utilities compartidas (paralelas entre si)

### T01 — Extraer `lib/shared/as-object.ts` (S)

- Crear `lib/shared/as-object.ts` con la funcion `asObject`
- Buscar con `rg "const asObject"` TODAS las definiciones locales (hay ~15)
- En cada archivo: borrar la definicion local, agregar `import { asObject } from "@/lib/shared/as-object"`
- Archivos afectados: `lib/security/staff-auth.ts`, `lib/security/staff-portal-auth.ts`, `lib/security/staff-account-sync.ts`, `app/api/staff/users/route.ts`, `app/api/staff/users/[userId]/route.ts`, `app/api/staff/users/[userId]/profile/route.ts`, `app/api/staff/checkin/pin/route.ts`, `app/api/staff/payments/shared.ts`, `app/api/staff/requests/route.ts`, `app/api/staff/requests/[requestId]/route.ts`, `app/api/staff/reports/suggestions/route.ts`, `app/api/staff/users/[userId]/performance/route.ts`, `lib/payroll/route-helpers.ts`, y mas — buscar con rg
- Verificar: `npx vitest run` + `rg "const asObject"` debe retornar 1 solo resultado

### T02 — Extraer `lib/shared/normalize.ts` (S)

- Crear `lib/shared/normalize.ts` con `normalizeString` y `normalizePhoneDigits`
- Buscar con `rg "const normalizeString|function normalizeString"` y `rg "normalizePhoneDigits"` todas las copias
- Archivos conocidos: `app/api/checkin/qr/bootstrap/route.ts`, `app/api/checkin/qr/dropin/route.ts`, `app/api/checkin/qr/package/route.ts`, `app/api/checkin/qr/new-student/verify/route.ts`, `app/api/profile/bookings/assign/route.ts`, `app/api/profile/bookings/checkin/route.ts`, `app/api/profile/bookings/reschedule/route.ts`
- En cada uno: borrar definicion local, agregar import desde `@/lib/shared/normalize`
- Verificar: `npx vitest run` + `rg "const normalizeString"` retorna 1 resultado

### T03 — Extraer `lib/shared/normalize-phone.ts` (S)

- PRIMERO: leer las 4 variantes para confirmar equivalencia semantica antes de unificar
- Crear `lib/shared/normalize-phone.ts` con signature canonica: `(value?: string | null): string`
- Archivos: `lib/users.ts`, `lib/checkout/validation.ts`, `app/api/stripe/webhook/route.ts`, `app/api/checkout/finalize/route.ts`
- Si las variantes difieren, usar la mas permisiva y agregar tests cubriendo edge cases
- Verificar: `npx vitest run`

### T04 — Extraer `lib/shared/timezone.ts` (S)

- Crear con `export const NY_TIMEZONE = "America/New_York"`
- Buscar con `rg '"America/New_York"'` todos los archivos
- Archivos conocidos: `lib/class-schedule.ts`, `lib/checkin/checkin-helpers.ts`, `app/api/staff/schedule/route.ts`, `app/api/profile/bookings/availability/route.ts`, `app/api/profile/activity/route.ts`, componentes (StaffUsersAdminClient, ProfilePageClient, EnrollModal, StaffTerminalSetupClient), `tests/class-schedule.test.ts`
- Verificar: `npx vitest run` + `rg '"America/New_York"'` retorna 0 resultados fuera de `timezone.ts`

---

### BLOQUE B — Staff PIN extraction (independiente de Bloque A)

### T05 — Crear `lib/security/staff-pin.ts` (S)

- Crear con `hashPin`, `isValidPinHash` (version timing-safe con `timingSafeEqual`), `isValidPinFormat`
- La version canonica de `isValidPinHash` viene de `app/api/staff/pin-auth/route.ts` que usa `timingSafeEqual` (las otras usan `===` plano — esto es una mejora de seguridad, no un cambio de logica)
- Borrar definiciones locales en: `app/api/staff/users/route.ts` (lineas ~30-38), `app/api/staff/users/[userId]/profile/route.ts` (lineas ~186-203), `app/api/staff/pin-auth/route.ts` (lineas ~13-32), `app/api/staff/checkin/pin/route.ts` (lineas ~19-37)
- Crear test: `tests/security/staff-pin.test.ts` — testear formato salt:hash, match correcto, match incorrecto, formato PIN valido/invalido
- Verificar: `npx vitest run` + `rg "const hashPin"` retorna 1 resultado

---

### BLOQUE C — Staff auth shared (independiente)

### T06 — Crear `lib/security/staff-auth-shared.ts` (S)

- Extraer de `lib/security/staff-auth.ts` Y `lib/security/staff-portal-auth.ts`: `parseSessionIssuedAtMs`, `parseForcedLogoutAtMs`, `parseDbRole`, `STAFF_ROLE_SET`
- Ambos archivos importan desde el nuevo modulo en vez de definir localmente
- NO cambiar ningun export publico de `staff-auth.ts` ni `staff-portal-auth.ts`
- Verificar: `npx vitest run`

---

### BLOQUE D — Student PIN decomposition (SECUENCIAL: T07 → T08 → T09 → T12)

### T07 — Extraer `lib/security/student-pin-crypto.ts` (M)

- Mover desde `student-pin.ts`: `ARGON_OPTIONS`, `getPepper()`, `endOfUtcDay()`, `subtractMonths()`, `createStudentPinLookupDigest()`, `hashStudentPin()`, `verifyStudentPinHash()`, `isStudentPinFormatValid()`, `assertStudentPinConfirmation()`
- `student-pin.ts`: borrar estas funciones, agregar `import` y `export` desde `student-pin-crypto`
- Verificar: `npx vitest run tests/security/student-pin.test.ts`

### T08 — Extraer `lib/security/student-pin-lifecycle.ts` (M)

- Mover types: `StudentPinKind`, `StudentPinStatusValue`, `StudentPinSummary`, `StudentPinTerminalThrottleState`, `StudentPinDbClient`
- Mover constants: `STUDENT_PIN_KINDS`, `STUDENT_PIN_STATUS`, `STUDENT_PIN_MAX_FAILED_ATTEMPTS`, `STUDENT_PIN_TERMINAL_MISS_WINDOW_MS`, `STUDENT_PIN_TERMINAL_BLOCK_MS`, `STUDENT_PIN_OBSOLETE_AFTER_MONTHS`, `STUDENT_PIN_ACTIVE_LOOKUP_STATUSES`
- Mover: `StudentPinConflictError` class
- Mover predicados puros: `isStudentPinLifecycleEnabled`, `isStudentPinConflictError`, `isLockedCredential`, `isStudentPinObsolete`, `requiresStudentPinRegeneration`, `isStudentPinExpired`, `isProvisionalStudentPinActive`
- Importa `subtractMonths` desde `student-pin-crypto.ts`
- `student-pin.ts`: borrar, re-exportar desde lifecycle
- Verificar: `npx vitest run tests/security/student-pin.test.ts`

### T09 — Extraer `lib/security/student-pin-repository.ts` (L)

- Mover TODAS las funciones async de DB (~400 lineas, 18 funciones exportadas)
- Incluye helpers privados: `findOwnedCredentialId`, `rethrowStudentPinConflict`, `buildCredentialState`
- Importa desde `student-pin-crypto.ts` y `student-pin-lifecycle.ts`
- `student-pin.ts`: borrar, re-exportar desde repository
- Verificar: `npx vitest run tests/security/student-pin.test.ts`

### T12 — Convertir `student-pin.ts` en barrel file (S)

- Reemplazar TODO el contenido de `lib/security/student-pin.ts` con:

```ts
export * from "./student-pin-crypto"
export * from "./student-pin-lifecycle"
export * from "./student-pin-repository"
```

- ZERO cambios de imports en los 9 archivos consumidores
- Verificar: `npx vitest run` completo

---

### BLOQUE E — Payment types (independiente)

### T10 — Crear `lib/staff/payment-types.ts` (S)

- Mover `StaffPaymentInfo`, `StaffPaymentPreference`, `PAYMENT_PREFERENCES` desde `lib/security/staff-category.ts`
- `staff-category.ts` re-exporta para backwards compat
- Verificar: `npx vitest run`

### T11 — Deduplicar `normalizeCategoryForRole` (S)

- Buscar con `rg "normalizeCategoryForRole"` todas las copias
- Exportar desde `lib/security/staff-category.ts` como funcion canonica
- Actualizar consumidores para importar
- Verificar: `npx vitest run`

---

### BLOQUE F — Verificacion final

### T13 — Validacion completa (S)

- `npx vitest run` — todo verde
- `npx tsc --noEmit` — sin errores de tipos
- Verificar deduplicacion: `rg "const asObject"` = 1, `rg "const normalizeString"` = 1, `rg "const hashPin"` = 1, `rg "const isValidPinHash"` = 1, `rg '"America/New_York"'` = 1 (en timezone.ts)
- Verificar que no hay circular imports entre student-pin sub-modulos

## Riesgos

| Riesgo | Mitigacion |
|--------|------------|
| `normalizePhone` variantes no son equivalentes | T03 requiere leer las 4 antes de unificar |
| `vi.mock` paths rotos por barrel re-export | Tests mockean `@/lib/security/student-pin` — barrel funciona igual |
| Circular imports en sub-modulos de student-pin | Direccion estricta: crypto <- lifecycle <- repository |
| Import olvidado en algun archivo | Cada tarea verifica con `rg` que quedan 0 copias locales |

## Acceptance Criteria

- **Zero breaking changes**: Todo `import { X } from "@/lib/security/..."` que era valido antes sigue valido despues
- **Zero cambios de logica**: Sin condicionales nuevos, sin cambios de algoritmo, sin cambios de API
- **Deduplicacion verificada**: cada rg retorna exactamente 1 resultado
- **Full test suite green**: `npx vitest run` pasa con zero failures
