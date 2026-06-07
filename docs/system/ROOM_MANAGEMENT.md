# Room Management

Guía funcional y técnica del dominio de salas administradas por staff.

## 1. Objetivo
- Reemplazar strings libres de ubicación por un modelo formal `Room`.
- Evitar doble reserva de una misma sala en sesiones superpuestas.
- Permitir que cursos y sesiones staff usen una sala opcional sin romper compatibilidad con registros legacy.

## 2. Modelo de datos
- `Room`
  - `id`
  - `name` único
  - `capacity > 0`
  - `location?`
  - `active` para soft-disable
- `ClassSession.roomId`
  - opcional para mantener sesiones legacy sin sala
- `CourseCatalog.defaultRoomId`
  - opcional para sugerir una sala por defecto al configurar cursos

## 3. Reglas de negocio

### 3.1 CRUD de salas
- Solo staff autorizado puede listar, crear, editar y desactivar salas.
- Una sala nueva queda activa por defecto.
- No se permiten nombres duplicados.
- Desactivar una sala la saca del selector de nuevas sesiones y cursos.

### 3.2 Asignación de sala en sesiones
- El flujo staff de check-in puede crear o actualizar `ClassSession` con `roomId` opcional.
- Si `roomId` es `null`, el flujo legacy sigue siendo válido.
- Si se envía `roomId`, la sala debe existir y estar activa.

### 3.3 Prevención de conflictos
- Dos sesiones no pueden compartir la misma sala si sus rangos UTC se superponen.
- Sesiones contiguas sin solapamiento sí son válidas.
- Las actualizaciones de una sesión existente deben excluir su propio `sessionId` al validar conflictos.
- El backend responde `409 Conflict` cuando la sala ya está ocupada para ese rango.

### 3.4 Sala por defecto en cursos
- Staff puede guardar `defaultRoomId` en `CourseCatalog`.
- Esa relación es opcional y no reemplaza otros datos existentes como `location` o `scheduleRules`.

## 4. Endpoints y superficies
- `GET /api/staff/rooms`
- `POST /api/staff/rooms`
- `PUT /api/staff/rooms/[id]`
- `DELETE /api/staff/rooms/[id]` (soft-disable)
- `POST /api/staff/checkin`
  - acepta `roomId` opcional
  - rechaza salas inactivas, inexistentes o en conflicto
- `GET/POST /api/staff/school/courses`
  - persiste `defaultRoomId` opcional

## 5. UI staff
- `StaffUsersAdminClient` expone gestión de salas dentro del portal staff.
- El formulario de cursos permite seleccionar una sala por defecto.
- `StaffCheckInClient` muestra información de sala y errores de conflicto de forma explícita.

## 6. Compatibilidad hacia atrás
- Sesiones existentes con `roomId = null` siguen funcionando.
- No se exige backfill histórico de salas.
- `location` se mantiene como dato complementario cuando aplica.

## 7. Tests relevantes
- `tests/class-schedule.test.ts`
- `tests/api/staff-checkin.test.ts`
- `tests/api/staff-school.test.ts`
- `tests/api/staff-rooms.test.ts`
- `components/front/staff/__tests__/StaffUsersAdminClient.test.ts`
