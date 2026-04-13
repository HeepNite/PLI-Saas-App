# Staff Portal (v1)

Guía de arquitectura, permisos y rutas del nuevo módulo Staff.

## 1. Rutas web
- `/staff/sign-in`: login staff.
- `/staff/sign-up`: alta de usuario staff (si corresponde).
- `/staff/resolve`: resuelve rol/categoría y redirige según permisos.
- `/staff/setup`: onboarding inicial para primer owner/admin.
- `/staff/portal`: panel admin (users + school + schedule + requests + payments).
- `/staff/portal`: panel admin (users + school + schedule + requests + payments + room management).
- `/staff/panel`: panel básico para staff no admin.
- `/staff/checkin`: terminal por PIN.
- `/staff/school/course/[slug]`: acceso directo a edición/preview de un curso del school canvas.

## 2. Roles y categorías
- Roles (`lib/security/staff-role.ts`):
  - `owner`
  - `admin`
  - `staff`
- Categorías (`lib/security/staff-category.ts`):
  - `front_desk`
  - `manager`
  - `teacher`
  - `guest_staff`
  - `partner`

## 3. Autorización
- Portal admin:
  - `authorizeStaffPortalRequest()` en `lib/security/staff-portal-auth.ts`.
  - Permite:
    - `owner`
    - `admin` con categoría `manager`
- Staff check-in API:
  - `authorizeStaffRequest()` en `lib/security/staff-auth.ts`.
  - Válido por:
    - Header `x-staff-token` (si `STAFF_CHECKIN_TOKEN` está definido), o
    - sesión Clerk con rol staff válido.

## 4. Endpoints principales staff

### 4.1 Bootstrap y acceso
- `POST /api/staff/bootstrap`
- `POST /api/staff/pin-auth`
- `POST /api/staff/checkin/pin`

### 4.2 Users admin
- `GET/POST /api/staff/users`
- `PATCH/DELETE /api/staff/users/[userId]`
- `GET/PATCH/DELETE /api/staff/users/[userId]/profile`
- `GET /api/staff/users/[userId]/performance`
- `POST /api/staff/users/[userId]/avatar`
- `POST /api/staff/users/[userId]/gallery-upload`

### 4.3 School config
- `GET/POST /api/staff/school/courses`
- `GET/POST /api/staff/school/packages`
- `GET/POST /api/staff/school/points-rules`
- `POST /api/staff/school/points-assign`

Notas:
- `CourseCatalog` acepta `defaultRoomId` opcional para asociar una sala por defecto.

### 4.3.1 Rooms
- `GET/POST /api/staff/rooms`
- `PUT/DELETE /api/staff/rooms/[id]`
- `DELETE` aplica soft-disable (`active=false`) y puede rechazar la operación si la sala sigue en uso según reglas de negocio.

### 4.4 Schedule / requests / payments
- `GET /api/staff/schedule`
- `GET/POST /api/staff/requests`
- `PATCH /api/staff/requests/[requestId]`
- `GET /api/staff/payments`
- `PATCH /api/staff/payments/[purchaseId]`
- `POST /api/staff/reports/suggestions`

### 4.5 Check-in operativo
- `POST /api/staff/checkin`

Notas:
- El payload acepta `roomId` opcional.
- Si la sala no existe, está inactiva o tiene solapamiento con otra `ClassSession`, la API responde error (`404`/`409`).
- Las sesiones legacy sin `roomId` siguen siendo válidas.

## 5. Terminal por PIN (staff/checkin)
- UI: `components/front/staff/StaffCheckInClient.tsx`.
- Endpoint: `POST /api/staff/checkin/pin`.
- Valida PIN de 4 dígitos contra hash en metadata de Clerk.
- Si valida:
  - actualiza presencia (`staffLastCheckInAt`, contador, estado online),
  - genera sign-in token Clerk,
  - redirige a `/staff/resolve`.

## 6. Tests actuales staff
- `tests/staff-role.test.ts`
- `tests/class-schedule.test.ts`
- `tests/api/staff-bootstrap.test.ts`
- `tests/api/staff-checkin.test.ts`
- `tests/api/staff-rooms.test.ts`
- `tests/api/staff-schedule.test.ts`
- `tests/api/staff-school.test.ts`
- `tests/api/staff-users.test.ts`
- `components/front/staff/__tests__/StaffUsersAdminClient.test.ts`
- `e2e/staff.spec.ts` (terminal PIN)

## 7. Estado de cobertura
- API/servicios staff: cubiertos por Vitest.
- E2E del terminal PIN: implementado.
- E2E visual del portal staff completo (`/staff/portal`): pendiente (recomendado siguiente iteración).

## 8. Integración IA para Reports (preparada)
- Frontend reports usa sugerencias locales por defecto.
- Botón `Generate AI suggestions` consulta `POST /api/staff/reports/suggestions`.
- Proveedores disponibles:
  - `mock` (default): devuelve estrategia local, útil en dev/demo.
  - `custom-http`: reenvía payload a un endpoint externo para conectar cualquier agente.
- Variables de entorno:
  - `AI_REPORTS_PROVIDER=mock|custom-http`
  - `AI_REPORTS_AGENT_URL=https://tu-endpoint`
  - `AI_REPORTS_AGENT_TOKEN=...` (opcional, bearer).
- Si el proveedor externo falla o devuelve vacío, el sistema hace fallback automático a sugerencias locales.
- Contrato esperado del endpoint externo (`custom-http`):
  - Request JSON: `{ objectiveFilter, metrics, suggestions }`
  - Response JSON mínima: `{ "suggestions": [ { id, objective, title, priority, insight, proposal, actions[], aiBrief } ] }`
  - Campos opcionales: `warning` (string)
