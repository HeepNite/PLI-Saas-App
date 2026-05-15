# PLI Demo — Guía de Instalación Local

> **Esta rama es exclusivamente para demos locales. No se puede deployar a producción.**

---

## TL;DR (versión ultra-rápida)

```bash
git clone https://github.com/HeepNite/PLI-Saas-App.git
cd PLI-Saas-App
git checkout demo/es-local
npm install
cp .env.demo.example .env.demo        # Después editá este archivo con tus keys de Clerk
npm run demo:setup                     # Necesita Docker Desktop abierto
npm run demo                           # Abrí http://localhost:3000
```

Si algo no funciona, seguí la guía detallada de abajo.

---

## Requisitos Previos

Necesitás tener estas 3 cosas instaladas **antes** de empezar:

### 1. Node.js (versión 20 o superior)

- Descargalo de: https://nodejs.org/
- Elegí la versión **LTS** (el botón verde grande)
- Instalalo con todas las opciones por defecto
- Para verificar que quedó bien, abrí una terminal y escribí:
  ```bash
  node -v
  ```
  Debería mostrar algo como `v20.x.x` o superior.

### 2. Docker Desktop

- Descargalo de: https://www.docker.com/products/docker-desktop/
- Instalalo con las opciones por defecto
- **Importante:** después de instalar, abrí Docker Desktop y esperá a que diga "Docker Desktop is running" (el ícono de la ballena en la barra de tareas se pone quieto)
- Para verificar, abrí una terminal y escribí:
  ```bash
  docker --version
  ```
  Debería mostrar algo como `Docker version 27.x.x`

### 3. Cuenta de Clerk (gratis)

- Andá a https://clerk.com y creá una cuenta
- Esto es para el sistema de login de la app — se configura en el Paso 3

### 4. (Opcional) Cuenta de Stripe

- Solo si querés probar pagos
- Si no, saltá esto — la app funciona igual

> **Nota:** Todos los comandos funcionan igual en **Windows**, **Mac** y **Linux**.

---

## Paso 1: Descargar el proyecto

Abrí una terminal (en Windows: buscá "Terminal" o "PowerShell" en el menú de inicio).

Copiá y pegá estos comandos **de a uno**:

```bash
git clone https://github.com/HeepNite/PLI-Saas-App.git
```

```bash
cd PLI-Saas-App
```

```bash
git checkout demo/es-local
```

```bash
npm install
```

> Este último tarda un rato (1-3 minutos). Esperá a que termine.

---

## Paso 2: Verificar Docker

Asegurate de que Docker Desktop esté abierto y corriendo.

Verificá con:

```bash
docker info
```

Si ves un montón de texto con información de Docker, está todo bien.
Si dice "Cannot connect to the Docker daemon", abrí Docker Desktop y esperá un minuto.

---

## Paso 3: Configurar las variables de entorno

Copiá el archivo de ejemplo:

```bash
cp .env.demo.example .env.demo
```

> **Windows (CMD):** Si `cp` no funciona, usá: `copy .env.demo.example .env.demo`

Ahora abrí el archivo `.env.demo` con cualquier editor de texto (Notepad, VS Code, lo que tengas).

### Configurar Clerk (obligatorio)

Necesitás 2 keys de Clerk. Seguí estos pasos:

1. Andá a https://clerk.com e iniciá sesión
2. Hacé click en **"Add application"** (o "Create application")
3. Ponele cualquier nombre (ej: "PLI Demo")
4. Elegí **"Next.js"** como framework
5. Hacé click en **"Create application"**
6. Te va a mostrar 2 keys. Copialas y remplazalas en `.env.demo`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_PEGA_TU_KEY_ACA
CLERK_SECRET_KEY=sk_test_PEGA_TU_KEY_ACA
```

> **Tip:** Las keys empiezan con `pk_test_` y `sk_test_`. Si no las ves, andá al menú lateral izquierdo > **API Keys**.

### Configurar Stripe (opcional)

Si querés probar pagos:

1. Andá a https://dashboard.stripe.com/test/apikeys
2. Copiá las test keys y remplazalas en `.env.demo`

Si **NO** vas a probar pagos, dejá las keys de Stripe como están (`YOUR_KEY_HERE`). No pasa nada.

**Guardá el archivo** después de hacer los cambios.

---

## Paso 4: Levantar la base de datos y seedear

Con Docker Desktop abierto, corré:

```bash
npm run demo:setup
```

Esto hace 3 cosas automáticamente:

1. **Crea un contenedor Docker** con PostgreSQL (la base de datos)
2. **Crea todas las tablas** necesarias
3. **Llena la base** con datos de demostración en español

Cuando termine, vas a ver esto:

```
🎭 Seedeando base de datos demo PLI...

✓ Monedas: ARS, USD
✓ Salas: Salón Principal, Sala de Ensayo, Estudio Privado
✓ Cursos: Salsa, Bachata, Tango, Ritmos Latinos, Danza Contemporánea
✓ Paquetes: Mensual 8, Trimestral Ilimitado, Clase Suelta
✓ Alumnos: María, Juan, Ana, Carlos, Lucía, Pedro (con perfiles)
✓ Staff: Valentina (admin), Matías (instructor), Camila (recepcionista)
✓ Reglas de puntos: Asistencia, Referido, Puntualidad
✓ Clases programadas: X sesiones en las próximas 2 semanas
✓ Paquetes comprados: María (Mensual), Juan (Trimestral), Ana (Mensual)
✓ Terminal: Recepción (PIN: 1234)

✅ ¡Demo seedeado con éxito!

🎉 ¡Setup completo!

Para iniciar el demo corré:

  npm run demo
```

> Si algo falla, revisá la sección **Solución de problemas** al final.

---

## Paso 5: Iniciar el demo

```bash
npm run demo
```

Abrí el navegador (Chrome, Firefox, Edge, el que tengas) y andá a:

### **http://localhost:3000**

Te va a redirigir automáticamente al **portal de staff**.

---

## ¿Qué puedo ver en el demo?

| Sección | Cómo llegar | Qué tiene |
|---------|-------------|-----------|
| **Staff Portal** | Se abre automático | Gestión de alumnos, asistencia, pagos |
| **Terminal Kiosk** | `/staff/terminal` | Check-in de alumnos, PIN: **1234** |
| **Perfil del cliente** | `/client-profile` | Vista del alumno con sus datos |

---

## Datos de demostración incluidos

| Tipo | Datos |
|------|-------|
| **Monedas** | ARS (Pesos Argentinos), USD |
| **Salas** | Salón Principal (20 pers.), Sala de Ensayo (10), Estudio Privado (5) |
| **Cursos** | Salsa Nivel 1, Bachata Intermedio, Tango Argentino, Ritmos Latinos, Danza Contemporánea |
| **Paquetes** | Pack Mensual 8 clases, Pack Trimestral Ilimitado, Clase Suelta |
| **Alumnos** | María López, Juan Rodríguez, Ana García, Carlos Martínez, Lucía Fernández, Pedro Sánchez |
| **Staff** | Valentina Romero (admin), Matías Herrera (instructor), Camila Torres (recepcionista) |
| **Clases** | Sesiones programadas para las próximas 2 semanas |
| **Terminal Kiosk** | "Terminal Recepción" — PIN: **1234** |

---

## Comandos útiles

| Comando | Qué hace | Cuándo usarlo |
|---------|----------|---------------|
| `npm run demo` | Inicia el servidor | Cada vez que querés usar el demo |
| `npm run demo:setup` | Crea todo desde cero | Solo la primera vez |
| `npm run demo:reset` | Borra y vuelve a cargar los datos | Si querés datos frescos |
| `npm run demo:db-start` | Enciende la base de datos | Si apagaste Docker y lo volviste a abrir |
| `npm run demo:db-stop` | Apaga la base de datos | Si querés liberar recursos |

### Flujo típico después de la primera vez

```bash
# 1. Abrí Docker Desktop (esperá que cargue)
# 2. Abrí una terminal y andá a la carpeta del proyecto:
cd PLI-Saas-App

# 3. Iniciá la base de datos (si estaba apagada):
npm run demo:db-start

# 4. Iniciá el demo:
npm run demo

# 5. Abrí http://localhost:3000 en el navegador
```

---

## Solución de problemas

### "Docker is not running" / "Cannot connect to the Docker daemon"

**Causa:** Docker Desktop no está abierto.

**Solución:** Abrí Docker Desktop desde el menú de inicio (Windows) o Applications (Mac). Esperá 30-60 segundos a que cargue. Después volvé a correr el comando.

### "Port 5433 is already in use"

**Causa:** Ya hay algo usando ese puerto.

**Solución:**

```bash
# Borrá el contenedor viejo y empezá de nuevo:
docker rm -f pli-demo
npm run demo:setup
```

### "CLERK_SECRET_KEY is missing" / la app no carga

**Causa:** Las keys de Clerk no están bien configuradas.

**Solución:**
1. Abrí `.env.demo` con un editor de texto
2. Verificá que las líneas de Clerk tengan tus keys reales (no `YOUR_KEY_HERE`)
3. Verificá que no haya espacios ni comillas alrededor de las keys
4. Guardá el archivo y volvé a correr `npm run demo`

### Quiero empezar de cero con datos limpios

```bash
npm run demo:reset
```

### El contenedor de Docker no arranca / "No such container: pli-demo"

```bash
# Si el contenedor no existe, corré el setup de nuevo:
npm run demo:setup
```

### "npm run demo" no arranca / "Cannot find module"

```bash
# Reinstalá las dependencias:
npm install

# Intentá de nuevo:
npm run demo
```

---

## ¿Qué incluye el demo?

- ✅ Portal de staff (gestión, admin, instructores)
- ✅ Terminal kiosk (check-in de alumnos)
- ✅ Perfil del cliente/alumno
- ✅ Sistema de asistencia
- ✅ Paquetes y planes
- ✅ Gestión de salas y reservas
- ✅ Sistema de puntos

## ¿Qué NO incluye?

- ❌ Landing page / página pública (se está rediseñando)
- ❌ Catálogo público de cursos (se está rediseñando)
- ❌ Página de búsqueda pública

Estas secciones están bloqueadas intencionalmente. El demo se enfoca en el CRM y las herramientas operativas.
