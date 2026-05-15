/**
 * Runtime DOM text replacement for Spanish locale.
 *
 * This module translates hardcoded English strings in the DOM to Spanish
 * WITHOUT modifying any component files. It uses a MutationObserver to
 * catch dynamically rendered text.
 *
 * Usage: import and call `startRuntimeTranslation()` once in the root layout
 * when the locale is "es". It self-cleans on unmount.
 *
 * Why this approach?
 * - Zero merge conflicts with codex/develop (no component files touched)
 * - Works with any component, including third-party
 * - Easy to maintain: add translations to the map below
 * - Demo-only: in production, use proper i18n key-based translations
 */

// ---------------------------------------------------------------------------
// Translation map: "English text" → "Spanish text"
// ---------------------------------------------------------------------------
// Matching is case-sensitive and exact (after trim).
// For partial matches or patterns, use the regex section at the bottom.
// ---------------------------------------------------------------------------

const TRANSLATIONS: Record<string, string> = {
  // ── Generic / Shared ─────────────────────────────────────────────
  "Save": "Guardar",
  "Save changes": "Guardar cambios",
  "Saving…": "Guardando…",
  "Saving...": "Guardando...",
  "Cancel": "Cancelar",
  "Close": "Cerrar",
  "Back": "Volver",
  "Next": "Siguiente",
  "Edit": "Editar",
  "Delete": "Eliminar",
  "Confirm": "Confirmar",
  "Submit": "Enviar",
  "Search": "Buscar",
  "Search…": "Buscar…",
  "Search...": "Buscar...",
  "Loading…": "Cargando…",
  "Loading...": "Cargando...",
  "Actions": "Acciones",
  "Status": "Estado",
  "Active": "Activo",
  "Inactive": "Inactivo",
  "Pending": "Pendiente",
  "None": "Ninguno",
  "Yes": "Sí",
  "No": "No",
  "All": "Todos",
  "Name": "Nombre",
  "Email": "Email",
  "Phone": "Teléfono",
  "Role": "Rol",
  "Category": "Categoría",
  "Notes": "Notas",
  "Details": "Detalles",
  "Description": "Descripción",
  "Created": "Creado",
  "Updated": "Actualizado",
  "Date": "Fecha",
  "Time": "Hora",
  "Duration": "Duración",
  "Location": "Ubicación",
  "Total": "Total",
  "Amount": "Monto",
  "Error": "Error",
  "Success": "Éxito",
  "Warning": "Advertencia",
  "Info": "Información",
  "Required": "Requerido",
  "Optional": "Opcional",
  "Enabled": "Habilitado",
  "Disabled": "Deshabilitado",
  "or": "o",
  "of": "de",
  "and": "y",
  "from": "desde",
  "to": "hasta",
  "on": "el",
  "at": "a las",
  "by": "por",
  "in": "en",
  "for": "para",
  "with": "con",
  "not": "no",
  "no": "no",

  // ── Staff Users / User Management ────────────────────────────────
  "User Management": "Gestión de Usuarios",
  "Staff Users": "Usuarios Staff",
  "Staff users": "Usuarios staff",
  "Staff Management": "Gestión de Staff",
  "Add User": "Agregar Usuario",
  "Add user": "Agregar usuario",
  "New User": "Nuevo Usuario",
  "Edit User": "Editar Usuario",
  "Edit user": "Editar usuario",
  "Delete User": "Eliminar Usuario",
  "User Details": "Detalles del Usuario",
  "User details": "Detalles del usuario",
  "User Profile": "Perfil del Usuario",
  "User profile": "Perfil del usuario",
  "First Name": "Nombre",
  "Last Name": "Apellido",
  "First name": "Nombre",
  "Last name": "Apellido",
  "Full Name": "Nombre Completo",
  "Full name": "Nombre completo",
  "Email Address": "Dirección de Email",
  "Phone Number": "Número de Teléfono",
  "Phone number": "Número de teléfono",
  "Date of Birth": "Fecha de Nacimiento",
  "Date of birth": "Fecha de nacimiento",
  "Emergency Contact": "Contacto de Emergencia",
  "Emergency contact": "Contacto de emergencia",
  "Emergency Contact Name": "Nombre del Contacto de Emergencia",
  "Emergency Contact Phone": "Teléfono de Emergencia",
  "Emergency Contact Relation": "Relación del Contacto de Emergencia",
  "Billing Address": "Dirección de Facturación",

  // ── Roles ────────────────────────────────────────────────────────
  "Admin": "Administrador",
  "admin": "administrador",
  "Instructor": "Instructor",
  "instructor": "instructor",
  "Receptionist": "Recepcionista",
  "receptionist": "recepcionista",
  "Super Admin": "Super Administrador",
  "super_admin": "super administrador",
  "Owner": "Propietario",
  "owner": "propietario",
  "Staff": "Staff",

  // ── Tabs / Filters ──────────────────────────────────────────────
  "All Users": "Todos los Usuarios",
  "Active Users": "Usuarios Activos",
  "Banned Users": "Usuarios Baneados",
  "Locked Users": "Usuarios Bloqueados",
  "Banned": "Baneado",
  "Locked": "Bloqueado",
  "Unlocked": "Desbloqueado",
  "Ban": "Banear",
  "Unban": "Desbanear",
  "Lock": "Bloquear",
  "Unlock": "Desbloquear",
  "Ban user": "Banear usuario",
  "Unban user": "Desbanear usuario",
  "Lock user": "Bloquear usuario",
  "Unlock user": "Desbloquear usuario",

  // ── Packages / Plans ────────────────────────────────────────────
  "Packages": "Paquetes",
  "Package": "Paquete",
  "Active Package": "Paquete Activo",
  "Active package": "Paquete activo",
  "No active package": "Sin paquete activo",
  "No Active Package": "Sin Paquete Activo",
  "Package Plan": "Plan de Paquete",
  "Package plan": "Plan de paquete",
  "Remaining Credits": "Créditos Restantes",
  "Remaining credits": "Créditos restantes",
  "Total Credits": "Créditos Totales",
  "Total credits": "Créditos totales",
  "Unlimited": "Ilimitado",
  "unlimited": "ilimitado",
  "Credits": "Créditos",
  "credits": "créditos",
  "Expires": "Vence",
  "Expired": "Vencido",
  "expires": "vence",
  "Valid until": "Válido hasta",
  "Classes": "Clases",
  "classes": "clases",
  "Make-ups": "Recuperatorios",
  "make-ups": "recuperatorios",

  // ── Attendance ───────────────────────────────────────────────────
  "Attendance": "Asistencia",
  "attendance": "asistencia",
  "Attendance History": "Historial de Asistencia",
  "Attendance history": "Historial de asistencia",
  "Attendance summary": "Resumen de asistencia",
  "Checked in": "Presente",
  "Checked In": "Presente",
  "checked_in": "presente",
  "Checked out": "Retirado",
  "Checked Out": "Retirado",
  "No show": "Ausente",
  "No Show": "Ausente",
  "no_show": "ausente",
  "Check in": "Registrar entrada",
  "Check In": "Registrar Entrada",
  "Check out": "Registrar salida",
  "Check Out": "Registrar Salida",
  "Check-in": "Check-in",
  "Add attendance": "Agregar asistencia",
  "No attendance records": "Sin registros de asistencia",
  "No attendance records found": "No se encontraron registros de asistencia",
  "Total classes": "Total de clases",
  "Classes attended": "Clases asistidas",
  "Completed classes": "Clases completadas",

  // ── Payments / Payroll ──────────────────────────────────────────
  "Payment": "Pago",
  "Payments": "Pagos",
  "Payment History": "Historial de Pagos",
  "Payment history": "Historial de pagos",
  "Payment Methods": "Métodos de Pago",
  "Payment methods": "Métodos de pago",
  "Payment Method": "Método de Pago",
  "Payment method": "Método de pago",
  "Add payment method": "Agregar método de pago",
  "Add Payment Method": "Agregar Método de Pago",
  "Set as Default": "Establecer como Predeterminado",
  "Set as default": "Establecer como predeterminado",
  "Default": "Predeterminado",
  "default": "predeterminado",
  "Paid": "Pagado",
  "paid": "pagado",
  "Unpaid": "Impago",
  "unpaid": "impago",
  "Paid in full": "Pagado en su totalidad",
  "Payment failed": "Pago fallido",
  "Payment pending": "Pago pendiente",
  "No payments found": "No se encontraron pagos",
  "No successful payments": "Sin pagos exitosos",
  "Payroll": "Nómina",
  "payroll": "nómina",
  "Payroll Entry": "Entrada de Nómina",
  "Gross Amount": "Monto Bruto",
  "Bonus Amount": "Monto de Bonus",
  "Total Amount": "Monto Total",
  "Total Amount:": "Monto Total:",
  "Hourly Rate": "Tarifa por Hora",
  "Hourly rate": "Tarifa por hora",
  "Hours Worked": "Horas Trabajadas",
  "Hours worked": "Horas trabajadas",
  "Period Start": "Inicio del Período",
  "Period End": "Fin del Período",
  "Cash": "Efectivo",
  "Card": "Tarjeta",
  "Bank Transfer": "Transferencia Bancaria",
  "Bank transfer": "Transferencia bancaria",
  "Account Number": "Número de Cuenta",
  "Account number": "Número de cuenta",
  "Bank Name": "Nombre del Banco",
  "Bank name": "Nombre del banco",
  "Routing Number": "Número de Ruta",
  "Routing number": "Número de ruta",
  "Zelle ID": "ID de Zelle",

  // ── Terminal / Kiosk ────────────────────────────────────────────
  "Terminal": "Terminal",
  "Terminal Manager": "Gestor de Terminales",
  "Terminal Setup": "Configuración de Terminal",
  "Terminal setup": "Configuración de terminal",
  "Edit terminal": "Editar terminal",
  "Create terminal": "Crear terminal",
  "Delete terminal": "Eliminar terminal",
  "Terminal Name": "Nombre del Terminal",
  "Terminal name": "Nombre del terminal",
  "Name is required.": "El nombre es requerido.",
  "PIN must be 4 digits.": "El PIN debe tener 4 dígitos.",
  "New PIN (optional)": "Nuevo PIN (opcional)",
  "Select a terminal.": "Seleccioná un terminal.",
  "Select a terminal": "Seleccioná un terminal",
  "Sign in": "Iniciar sesión",
  "Sign In": "Iniciar Sesión",
  "Sign out": "Cerrar sesión",
  "Sign Out": "Cerrar Sesión",
  "PIN check-in": "Check-in por PIN",
  "PIN Check-in": "Check-in por PIN",
  "Delete last digit": "Borrar último dígito",
  "Validating…": "Validando…",
  "Validating...": "Validando...",
  "Enter PIN": "Ingresá el PIN",
  "Enter your PIN": "Ingresá tu PIN",
  "Current class": "Clase actual",
  "TEST MODE": "MODO PRUEBA",

  // ── Schedule / Sessions ─────────────────────────────────────────
  "Schedule": "Agenda",
  "schedule": "agenda",
  "Class Session": "Sesión de Clase",
  "Class session": "Sesión de clase",
  "Class Sessions": "Sesiones de Clase",
  "No classes scheduled": "No hay clases programadas",
  "No class location": "Sin ubicación de clase",
  "Upcoming classes": "Próximas clases",
  "Today": "Hoy",
  "Tomorrow": "Mañana",
  "Yesterday": "Ayer",
  "This week": "Esta semana",
  "Next week": "Próxima semana",
  "This month": "Este mes",

  // ── Rooms ───────────────────────────────────────────────────────
  "Rooms": "Salas",
  "Room": "Sala",
  "Manage Rooms": "Gestionar Salas",
  "Room Management": "Gestión de Salas",
  "Capacity": "Capacidad",
  "capacity": "capacidad",
  "Room Reservations": "Reservas de Sala",
  "Room reservations": "Reservas de sala",
  "Reservation": "Reserva",
  "reservation": "reserva",
  "Reservations": "Reservas",

  // ── Courses ─────────────────────────────────────────────────────
  "Courses": "Cursos",
  "Course": "Curso",
  "Assign Courses": "Asignar Cursos",
  "Course Management": "Gestión de Cursos",
  "Pricing & Credits": "Precios y Créditos",

  // ── Points ──────────────────────────────────────────────────────
  "Points": "Puntos",
  "points": "puntos",
  "Points History": "Historial de Puntos",
  "Total Points": "Puntos Totales",
  "Total points": "Puntos totales",

  // ── Audit / History ─────────────────────────────────────────────
  "Audit History": "Historial de Auditoría",
  "Audit history": "Historial de auditoría",
  "Audit Log": "Registro de Auditoría",
  "No changes": "Sin cambios",
  "No value": "Sin valor",
  "Changed by": "Modificado por",
  "Unknown staff": "Staff desconocido",
  "Unknown": "Desconocido",
  "unknown": "desconocido",
  "just now": "recién",
  "Previous value": "Valor anterior",
  "New value": "Nuevo valor",

  // ── Bootstrap / First Setup ─────────────────────────────────────
  "First admin setup": "Configuración inicial del administrador",
  "Create super admin": "Crear super administrador",
  "Bootstrap failed": "Falló la configuración inicial",

  // ── Clerk Sync ──────────────────────────────────────────────────
  "Identity mismatch with Clerk": "Discrepancia de identidad con Clerk",
  "DB → Clerk": "BD → Clerk",
  "Clerk → DB": "Clerk → BD",
  "Phone is locked by policy…": "El teléfono está bloqueado por política…",
  "Sync": "Sincronizar",
  "Synced": "Sincronizado",

  // ── Student Data / Overrides ────────────────────────────────────
  "Student Profile": "Perfil del Alumno",
  "Student profile": "Perfil del alumno",
  "Student Data": "Datos del Alumno",
  "Apply override": "Aplicar ajuste",
  "Apply Override": "Aplicar Ajuste",
  "Override": "Ajuste",
  "override": "ajuste",
  "Completed classes override": "Ajuste de clases completadas",
  "Package classes used override": "Ajuste de clases de paquete usadas",

  // ── Client Profile Page ─────────────────────────────────────────
  "Client Profile": "Perfil del Cliente",
  "Client profile": "Perfil del cliente",
  "My Profile": "Mi Perfil",
  "My profile": "Mi perfil",
  "My Courses": "Mis Cursos",
  "My courses": "Mis cursos",
  "Dashboard": "Panel",
  "dashboard": "panel",

  // ── School Wizard ───────────────────────────────────────────────
  "School Setup": "Configuración de la Escuela",
  "Wizard steps": "Pasos del asistente",
  "Entity tabs": "Pestañas de entidad",

  // ── Table / List ────────────────────────────────────────────────
  "No results found": "No se encontraron resultados",
  "No results found.": "No se encontraron resultados.",
  "No results": "Sin resultados",
  "No data": "Sin datos",
  "No data available": "No hay datos disponibles",
  "No records found": "No se encontraron registros",
  "Showing": "Mostrando",
  "results": "resultados",
  "Page": "Página",
  "Previous": "Anterior",
  "First": "Primero",
  "Last": "Último",
  "Rows per page": "Filas por página",
  "Sort by": "Ordenar por",
  "Filter": "Filtrar",
  "Filter by": "Filtrar por",
  "Filters": "Filtros",
  "Clear filters": "Limpiar filtros",
  "Clear": "Limpiar",
  "Reset": "Reiniciar",
  "Apply": "Aplicar",
  "Select": "Seleccionar",
  "Select all": "Seleccionar todo",
  "Deselect all": "Deseleccionar todo",
  "Selected": "Seleccionado",
  "selected": "seleccionado",
  "Export": "Exportar",
  "Import": "Importar",
  "Download": "Descargar",
  "Upload": "Subir",
  "Refresh": "Actualizar",
  "Retry": "Reintentar",

  // ── Error / Loading States ──────────────────────────────────────
  "Failed to load": "Error al cargar",
  "Failed to load staff users": "Error al cargar usuarios staff",
  "Failed to save": "Error al guardar",
  "Failed to delete": "Error al eliminar",
  "Failed to update": "Error al actualizar",
  "Failed to create": "Error al crear",
  "Failed to load sessions": "Error al cargar sesiones",
  "Something went wrong": "Algo salió mal",
  "Something went wrong.": "Algo salió mal.",
  "An error occurred": "Ocurrió un error",
  "Please try again": "Intentá de nuevo",
  "Please try again.": "Intentá de nuevo.",
  "Network error": "Error de red",
  "Network error. Please try again.": "Error de red. Intentá de nuevo.",
  "Search failed. Please try again.": "Falló la búsqueda. Intentá de nuevo.",
  "Action failed": "La acción falló",
  "Not found": "No encontrado",
  "Unauthorized": "No autorizado",
  "Forbidden": "Prohibido",
  "Request failed": "La solicitud falló",

  // ── Confirmation Dialogs ────────────────────────────────────────
  "Are you sure?": "¿Estás seguro/a?",
  "This action cannot be undone.": "Esta acción no se puede deshacer.",
  "This action cannot be undone": "Esta acción no se puede deshacer",
  "Confirm deletion": "Confirmar eliminación",
  "Confirm action": "Confirmar acción",

  // ── Time / Calendar ─────────────────────────────────────────────
  "January": "Enero",
  "February": "Febrero",
  "March": "Marzo",
  "April": "Abril",
  "May": "Mayo",
  "June": "Junio",
  "July": "Julio",
  "August": "Agosto",
  "September": "Septiembre",
  "October": "Octubre",
  "November": "Noviembre",
  "December": "Diciembre",
  "Mon": "Lun",
  "Tue": "Mar",
  "Wed": "Mié",
  "Thu": "Jue",
  "Fri": "Vie",
  "Sat": "Sáb",
  "Sun": "Dom",
  "Monday": "Lunes",
  "Tuesday": "Martes",
  "Wednesday": "Miércoles",
  "Thursday": "Jueves",
  "Friday": "Viernes",
  "Saturday": "Sábado",
  "Sunday": "Domingo",
  "Previous month": "Mes anterior",
  "Next month": "Mes siguiente",
  "Clear date": "Limpiar fecha",
  "Select date": "Seleccionar fecha",
  "AM": "AM",
  "PM": "PM",
  "hours": "horas",
  "minutes": "minutos",
  "min": "min",
  "hrs": "hs",
  "ago": "atrás",

  // ── Page Titles / Metadata ──────────────────────────────────────
  "Staff log in — PLI": "Ingreso staff — PLI",
  "Staff PIN log-in with session creation.": "Ingreso de staff por PIN con creación de sesión.",
  "Go to student sign in": "Ir al ingreso de alumnos",
  "Staff access resolve — PLI": "Resolución de acceso staff — PLI",
  "Assign staff access role and redirect.": "Asignar rol de acceso staff y redirigir.",
  "Staff panel — PLI": "Panel staff — PLI",
  "Staff control panel.": "Panel de control staff.",
  "Staff users admin — PLI": "Admin de usuarios staff — PLI",
  "Manage staff users, roles, and access": "Gestionar usuarios staff, roles y accesos",
  "Staff terminal — PLI": "Terminal staff — PLI",
  "Staff terminal setup — PLI": "Configuración de terminal staff — PLI",
  "Create and manage kiosk terminals…": "Crear y gestionar terminales kiosk…",
  "Staff PIN terminal — PLI": "Terminal PIN staff — PLI",
  "PIN check-in terminal for staff entry.": "Terminal de check-in por PIN para ingreso de staff.",
  "Client Profile — PLI": "Perfil del Cliente — PLI",
  "Student profile with progress, packages, and bookings.": "Perfil del alumno con progreso, paquetes y reservas.",
  "QR Check-in — PLI": "QR Check-in — PLI",
  "QR check-in flow for new and returning students.": "Flujo de check-in por QR para alumnos nuevos y recurrentes.",
  "Dedicated kiosk terminal…": "Terminal kiosk dedicado…",

  // ── Misc Staff UI ───────────────────────────────────────────────
  "View": "Ver",
  "view": "ver",
  "More": "Más",
  "more": "más",
  "Less": "Menos",
  "less": "menos",
  "Show more": "Ver más",
  "Show less": "Ver menos",
  "Expand": "Expandir",
  "Collapse": "Colapsar",
  "Copy": "Copiar",
  "Copied!": "¡Copiado!",
  "Copied": "Copiado",
  "Share": "Compartir",
  "Print": "Imprimir",
  "Settings": "Configuración",
  "Preferences": "Preferencias",
  "Help": "Ayuda",
  "About": "Acerca de",
  "Version": "Versión",
  "Logout": "Cerrar sesión",
  "Log out": "Cerrar sesión",
  "Log in": "Iniciar sesión",
  "Welcome": "Bienvenido/a",
  "Hello": "Hola",
  "Student": "Alumno",
  "Students": "Alumnos",
  "student": "alumno",
  "students": "alumnos",
  "Teacher": "Profesor/a",
  "teacher": "profesor/a",
  "Teachers": "Profesores",
  "Member": "Miembro",
  "Members": "Miembros",
  "Guest": "Invitado",
  "Guests": "Invitados",
  "Create": "Crear",
  "Update": "Actualizar",
  "Remove": "Quitar",
  "Add": "Agregar",
  "Assign": "Asignar",
  "Unassign": "Desasignar",
  "Activate": "Activar",
  "Deactivate": "Desactivar",
  "Enable": "Habilitar",
  "Disable": "Deshabilitar",
  "Approve": "Aprobar",
  "Reject": "Rechazar",
  "Review": "Revisar",
  "Pending review": "Revisión pendiente",
  "Approved": "Aprobado",
  "Rejected": "Rechazado",
  "Cancelled": "Cancelado",
  "Completed": "Completado",
  "In progress": "En progreso",
  "Not started": "No iniciado",
  "Overdue": "Vencido",
  "On time": "A tiempo",
  "Late": "Tarde",
  "Early": "Temprano",
}

// ---------------------------------------------------------------------------
// Regex-based translations for dynamic patterns
// ---------------------------------------------------------------------------

const REGEX_TRANSLATIONS: Array<{ pattern: RegExp; replace: string | ((match: RegExpMatchArray) => string) }> = [
  // "X of Y results" → "X de Y resultados"
  { pattern: /^(\d+)\s+of\s+(\d+)\s+results?$/i, replace: "$1 de $2 resultados" },
  // "Page X of Y" → "Página X de Y"
  { pattern: /^Page\s+(\d+)\s+of\s+(\d+)$/i, replace: "Página $1 de $2" },
  // "Showing X to Y of Z" → "Mostrando X a Y de Z"
  { pattern: /^Showing\s+(\d+)\s+to\s+(\d+)\s+of\s+(\d+)$/i, replace: "Mostrando $1 a $2 de $3" },
  // "X minutes ago" → "hace X minutos"
  { pattern: /^(\d+)\s+minutes?\s+ago$/i, replace: "hace $1 minutos" },
  // "X hours ago" → "hace X horas"
  { pattern: /^(\d+)\s+hours?\s+ago$/i, replace: "hace $1 horas" },
  // "X days ago" → "hace X días"
  { pattern: /^(\d+)\s+days?\s+ago$/i, replace: "hace $1 días" },
  // "X classes remaining" → "X clases restantes"
  { pattern: /^(\d+)\s+classes?\s+remaining$/i, replace: "$1 clases restantes" },
  // "X credits remaining" → "X créditos restantes"
  { pattern: /^(\d+)\s+credits?\s+remaining$/i, replace: "$1 créditos restantes" },
]

// ---------------------------------------------------------------------------
// Translation engine
// ---------------------------------------------------------------------------

function translateText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  // Exact match
  const exact = TRANSLATIONS[trimmed]
  if (exact) return exact

  // Regex match
  for (const { pattern, replace } of REGEX_TRANSLATIONS) {
    const match = trimmed.match(pattern)
    if (match) {
      if (typeof replace === "function") return replace(match)
      return trimmed.replace(pattern, replace)
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// DOM walker + MutationObserver
// ---------------------------------------------------------------------------

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "INPUT", "SVG", "NOSCRIPT"])
const TRANSLATED_ATTR = "data-i18n-translated"

function translateNode(node: Text) {
  const parent = node.parentElement
  if (!parent) return
  if (SKIP_TAGS.has(parent.tagName)) return
  if (parent.hasAttribute(TRANSLATED_ATTR)) return

  const original = node.textContent
  if (!original || !original.trim()) return

  const translated = translateText(original)
  if (translated && translated !== original.trim()) {
    // Preserve leading/trailing whitespace from original
    const leading = original.match(/^\s*/)?.[0] ?? ""
    const trailing = original.match(/\s*$/)?.[0] ?? ""
    node.textContent = `${leading}${translated}${trailing}`
    parent.setAttribute(TRANSLATED_ATTR, "1")
  }
}

function translatePlaceholders(el: Element) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const ph = el.getAttribute("placeholder")
    if (ph) {
      const translated = translateText(ph)
      if (translated) el.setAttribute("placeholder", translated)
    }
  }
  // title attribute
  const title = el.getAttribute("title")
  if (title) {
    const translated = translateText(title)
    if (translated) el.setAttribute("title", translated)
  }
  // aria-label
  const ariaLabel = el.getAttribute("aria-label")
  if (ariaLabel) {
    const translated = translateText(ariaLabel)
    if (translated) el.setAttribute("aria-label", translated)
  }
}

function walkAndTranslate(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null)
  let current = walker.nextNode()
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateNode(current as Text)
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      translatePlaceholders(current as Element)
    }
    current = walker.nextNode()
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let observer: MutationObserver | null = null

export function startRuntimeTranslation() {
  if (typeof window === "undefined") return () => {}

  // Initial pass
  walkAndTranslate(document.body)

  // Observe future changes
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            translateNode(node as Text)
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            walkAndTranslate(node)
          }
        }
      } else if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        const parent = mutation.target.parentElement
        if (parent) parent.removeAttribute(TRANSLATED_ATTR)
        translateNode(mutation.target as Text)
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  // Return cleanup function
  return () => {
    observer?.disconnect()
    observer = null
  }
}

export function stopRuntimeTranslation() {
  observer?.disconnect()
  observer = null
}
