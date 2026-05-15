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

Necesitás instalar estas 4 cosas **antes** de empezar. Seguí el orden.

> **Nota:** Todos los comandos de esta guía funcionan igual en **Windows**, **Mac** y **Linux**.

---

### 1. Git

Git es la herramienta para descargar el código del proyecto.

1. Descargalo de: https://git-scm.com/downloads
2. Instalalo con **todas las opciones por defecto** (siguiente, siguiente, siguiente...)
3. **En Windows:** cuando te pregunte el editor, dejá el que viene por defecto
4. Para verificar, abrí una terminal y escribí:
   ```bash
   git --version
   ```
   Debería mostrar algo como `git version 2.x.x`

> **¿Cómo abro una terminal?**
> - **Windows:** Buscá "Terminal" o "PowerShell" en el menú de inicio
> - **Mac:** Abrí la app "Terminal" (está en Aplicaciones > Utilidades)

---

### 2. Node.js (versión 20 o superior)

Node.js es lo que hace correr la aplicación.

1. Descargalo de: https://nodejs.org/
2. Hacé click en el botón verde grande que dice **"LTS"** (versión estable)
3. Instalalo con **todas las opciones por defecto**
4. **Cerrá y volvé a abrir la terminal** (esto es importante para que reconozca el comando)
5. Verificá que quedó bien:
   ```bash
   node -v
   ```
   Debería mostrar algo como `v20.x.x` o `v22.x.x`
6. Verificá también npm (viene con Node):
   ```bash
   npm -v
   ```
   Debería mostrar un número como `10.x.x`

---

### 3. Docker Desktop

Docker es lo que levanta la base de datos localmente (sin tener que instalar PostgreSQL).

1. Descargalo de: https://www.docker.com/products/docker-desktop/
2. Instalalo con las opciones por defecto
3. **Reiniciá la computadora si te lo pide** (en Windows suele pedirlo)
4. Después de reiniciar, **abrí Docker Desktop**
5. Esperá a que diga "Docker Desktop is running" (el ícono de la ballena en la barra de tareas se pone quieto — puede tardar 1-2 minutos la primera vez)
6. Verificá en la terminal:
   ```bash
   docker --version
   ```
   Debería mostrar algo como `Docker version 27.x.x`

> **Windows:** Si te pide instalar "WSL 2", seguí las instrucciones que te muestra. Es necesario para que Docker funcione.

---

### 4. Cuenta de Clerk (gratis)

Clerk es el sistema de login de la app. Necesitás una cuenta para obtener las keys de autenticación.

1. Andá a https://clerk.com
2. Hacé click en **"Sign up"** y creá una cuenta (podés usar tu email o cuenta de Google/GitHub)
3. Una vez adentro, hacé click en **"Add application"**
4. Ponele cualquier nombre (ej: "PLI Demo")
5. Elegí **"Next.js"** como framework
6. Hacé click en **"Create application"**
7. Te va a mostrar **2 keys** — dejalas ahí, las vas a necesitar en el Paso 3

> Las keys empiezan con `pk_test_` y `sk_test_`. Si cerraste la página, las encontrás en el menú lateral > **API Keys**.

---

### 5. (Opcional) Cuenta de Stripe

Solo si querés probar el sistema de pagos. Si no, saltá esto — la app funciona igual sin Stripe.

- Creá una cuenta en https://stripe.com
- Las test keys están en: https://dashboard.stripe.com/test/apikeys

---

## Paso 1: Descargar el proyecto

Abrí una terminal:
- **Windows:** Buscá "Terminal" o "PowerShell" en el menú de inicio
- **Mac:** Abrí la app "Terminal"

Copiá y pegá estos comandos **de a uno** (pegá uno, esperá que termine, pegá el siguiente):

**Descargar el código:**
```bash
git clone https://github.com/HeepNite/PLI-Saas-App.git
```
> Esto crea una carpeta `PLI-Saas-App` donde estés parado (generalmente en `C:\Users\TuNombre` en Windows o `/Users/TuNombre` en Mac).

**Entrar a la carpeta:**
```bash
cd PLI-Saas-App
```

**Cambiar a la rama del demo:**
```bash
git checkout demo/es-local
```

**Instalar las dependencias:**
```bash
npm install
```
> Este tarda un rato (1-5 minutos dependiendo de tu conexión). Esperá a que termine — cuando vuelve a aparecer el cursor parpadeando, terminó.

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

Las variables de entorno son como las "contraseñas y configuraciones" que la app necesita para funcionar. Vamos a crearlas.

**Copiar el archivo de ejemplo:**

```bash
cp .env.demo.example .env.demo
```

> **Windows (si `cp` no funciona):** Usá este comando en su lugar:
> ```bash
> copy .env.demo.example .env.demo
> ```

**Ahora hay que editar el archivo `.env.demo`:**

Abrilo con cualquier editor de texto:
- **Windows:** Click derecho sobre el archivo > "Abrir con" > Bloc de notas (o VS Code si lo tenés)
- **Mac:** `open -e .env.demo` en la terminal, o abrilo con TextEdit
- **Desde la terminal (cualquier sistema):** `code .env.demo` si tenés VS Code

### Configurar Clerk (obligatorio)

Dentro del archivo `.env.demo`, buscá estas dos líneas:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

Reemplazá `YOUR_KEY_HERE` con tus keys reales de Clerk:

1. Andá a https://dashboard.clerk.com
2. Seleccioná tu aplicación (la que creaste en el paso de Requisitos)
3. En el menú lateral izquierdo, hacé click en **"API Keys"**
4. Vas a ver dos keys:
   - **Publishable key** — empieza con `pk_test_`
   - **Secret key** — empieza con `sk_test_`
5. Copiá cada una y pegala en el lugar correcto en `.env.demo`

**Ejemplo** de cómo debería quedar (las keys son inventadas):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_abc123xyz456
CLERK_SECRET_KEY=sk_test_def789ghi012
```

### Configurar Stripe (opcional)

Si querés probar pagos, buscá estas líneas en `.env.demo`:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
```

Y reemplazalas con tus test keys de https://dashboard.stripe.com/test/apikeys

Si **NO** vas a probar pagos, **dejá las keys como están** (`YOUR_KEY_HERE`). No pasa nada, la app funciona igual.

### Guardar el archivo

**No te olvides de guardar** (Ctrl+S en Windows, Cmd+S en Mac) después de hacer los cambios.

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
