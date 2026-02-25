# Smoke Checklist — Demo en Vercel

Checklist operativo para validar la versión demo online después de deploy.

## 1. Pre-requisitos
- Branch desplegada: `Develop` (commit objetivo).
- Base de datos remota accesible por `DATABASE_URL`.
- Variables de entorno configuradas en Vercel:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SITE_URL`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_WEBHOOK_SECRET` (si vas a validar webhook real)
  - `STAFF_CHECKIN_TOKEN` (si usás check-in staff por token)

## 2. Migraciones antes de validar
Ejecutar contra la DB demo:

```bash
npx prisma migrate deploy
```

Si querés confirmar estado:

```bash
npx prisma migrate status
```

## 3. Deploy en Vercel (plan free)
1. Importar repo `HeepNite/PLI-Saas-App` en Vercel.
2. Configurar env vars del punto 1 para el entorno Preview/Demo.
3. Deploy de la rama `Develop` (o promover preview a demo).
4. Confirmar que build termina sin errores.

## 4. Smoke tests funcionales (manual)

### 4.1 Compra base
1. Abrir un curso `/cursos/[slug]?enroll=1`.
2. Completar flujo hasta payment.
3. Validar que abre modal de pago.

Resultado esperado:
- Flujo completa sin errores de UI/API.

### 4.2 QR check-in — alumno nuevo
1. Abrir `/checkin` con `courseSlug/date/time` válidos.
2. Click `Soy nuevo`.
3. Completar teléfono no registrado y avanzar.

Resultado esperado:
- No bloquea como usuario existente.
- Avanza al flujo de compra regular.

### 4.3 QR check-in — teléfono ya registrado con compras
1. En `Soy nuevo`, usar teléfono con compras previas.

Resultado esperado:
- Muestra popup intermedio indicando usuario registrado.
- Pide login (no pasa directo a payment como nuevo).

### 4.4 QR check-in — usuario existente con recompra
1. Click `Ya soy cliente`.
2. Login en popup.
3. Esperar carga de card del curso actual.

Resultado esperado:
- Muestra card de curso actual.
- Botón `Recompra` cuando aplica.
- Si no aplica recompra, botón `Comprar` con precio regular.

### 4.5 Staff portal acceso
1. Ir a `/staff/sign-in`.
2. Login con usuario staff.
3. Validar redirección por `/staff/resolve`.

Resultado esperado:
- Owner/admin manager entra a `/staff/portal`.
- Staff no admin entra a `/staff/panel`.

### 4.6 Staff check-in por PIN (si está configurado)
1. Abrir `/staff/checkin`.
2. Ingresar PIN válido.

Resultado esperado:
- Marca entrada.
- Redirige a `/staff/resolve` y luego al panel correspondiente.

## 5. Suite automatizada recomendada pre/post deploy

```bash
npm run test
npm run test:e2e
```

## 6. Incidentes frecuentes
- 401 en rutas protegidas:
  - revisar sesión Clerk y/o roles metadata.
- Error DB/migración:
  - correr `prisma migrate deploy` sobre DB demo.
- Check-in fuera de ventana:
  - validar `date/time/durationMinutes` del QR contra hora real.
