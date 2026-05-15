export type Locale = "en" | "es"

const enTranslations = {
    // Generic
    back: "Back",
    cancel: "Cancel",
    continue: "Continue",
    confirm: "Confirm",
    myPanel: "My Panel",
    myCourses: "My Courses",
    signIn: "Sign in",
    getInTouch: "Get in touch",
    assistantChatNote: "We centralize everything in the assistant chat.",
    calendarsHint: "Select a date and time to enable calendars.",
    booking: "Booking",
    summary: "Summary",
    service: "Service",
    package: "Package",
    extras: "Extras",
    people: "People",
    dateTime: "Date/Time",
    email: "Email",
    total: "Total",
    demo: "demo",
    done: "Done",
    reviewAndConfirm: "Review and confirm",
    course: "Course",
    name: "Name",
    paymentMethod: "Payment method",
    notes: "Notes",
    estimatedTotal: "Estimated total",
    classWord: "Class",

    // Steps
    step_party: "Bringing anyone with you?",
    step_datetime: "Date & Time",
    step_info: "Your Information",
    step_payments: "Payments",
    step_review: "Review & Confirm",

    // Form labels
    label_service: "Service",
    label_companion: "Are you coming with someone?",
    onePerson: "person",
    manyPeople: "people",
    optionalPackages: "Optional packages",
    removeSelection: "Remove selection",
    packagesHint: "You can pick a package or skip it below. It's optional.",
    or: "or",
    skipPackages: "Skip packages and continue",
    label_extras: "Extras",
    label_selectTime: "Select a time",
    label_firstName: "First Name",
    label_lastName: "Last Name",
    label_email: "Email",
    label_notes: "Notes",
    placeholder_firstName: "Enter first name",
    placeholder_lastName: "Enter last name",
    placeholder_email: "Enter email",
    placeholder_notes: "Anything we should know…",
    phoneRemovedNote: "Phone removed. You will be able to continue via the assistant chat soon.",

    // Payments
    payments_summary: "Summary",
    payments_classes: "Classes",
    payments_coupon: "Coupon:",
    payments_coupon_placeholder: "e.g. PLI10",
    payments_remove: "Remove",
    payments_add: "Add",
    payments_invalidCoupon: "Invalid coupon (use PLI10 or PLI20 in demo)",
    payments_totalAmount: "Total Amount:",
    payments_method: "Payment Method",
    payments_onSite: "Cash",
    payments_onSite_desc: "Pay in cash at the front desk.",
    payments_stripe: "Card",
    payments_stripe_desc: "Pay with card.",
    new_student_single_notice: "New student price applies to 1 person only.",
    new_student_verify_phone: "Verify your phone by SMS to unlock the new student price.",
    verify_phone_cta: "Verify phone now",
    account_exists_error: "We found an existing account for this email or phone.",
    account_exists_cta: "Sign in to continue",
    account_exists_title: "Sign in to continue",
    account_exists_signed_in: "We couldn't validate your session yet. Please try again in a moment.",
    new_student_existing_error:
      "Aaahh, a returning student trying to be clever? Just kidding. You'll just pay the regular class price.",
    existing_customer_signin_required:
      "This phone number is already registered. Please sign in to continue.",
    identity_check_failed: "We couldn't verify your account right now. Please try again.",
    verifyingAccount: "Verifying...",
    account_exists_back: "Back to form",
    sign_in_modal_title: "Sign in",
    sign_in_modal_subtitle: "Use your phone number to continue.",
    phone_format_hint: "Use a valid US phone number (10 digits).",
    verify_phone_title: "Verify your phone",
    verify_phone_subtitle: "We use SMS verification to protect the new student price.",
    verify_phone_signed_out: "Sign in to verify your phone and continue.",
    verify_phone_back: "Back to courses",

    // Success and calendar
    addToCalendar: "Add to Calendar",
    congratulations: "Congratulations",
    appointmentId: "Appointment ID #",
    date: "Date:",
    localTime: "Local Time:",
    teacher: "Teacher:",
    location: "Location:",
    payment: "Payment:",
    customerPanel: "Customer Panel",
    finish: "Finish",
    googleCal_details: "Booking at PLI. Participants: {participants}. Total demo: ${total}.",
    ics_description: "Booking at PLI. Participants: {participants}. Total (demo): ${total}.",

    // ARIA
    aria_close: "Close",
    aria_dialog_bookingFor: "Booking for {title}",
    aria_switchLanguage: "Switch language",

    // Header/assistant
    assistant_title: "Hi! I’m your assistant. How can I help?",
    assistant_cta: "Start chat",

    // Notification bar
    notif_announcement: "Announcement: purchases in the next 12 hours qualify for special deals and updates.",
    notif_close: "Close notification",
    notif_cta: "Go to discounted course",

    // Search
    searchPlaceholder: "Search courses…",
    aria_search: "Search",

    // Home hero
    hero_title: "Learn from the best, be your best.",
    hero_subtitle: "Get unlimited access to thousands of bite-sized lessons.",
    hero_question: "What brings you to Palladium Latin Institute today?",

    // Course page
    courseNotFoundTitle: "Course not found",
    courseNotFoundBody: "Check the link or return to the catalog.",

    // Header/menu & navigation
    explore: "Explore",
    notSureStart: "Not sure where to start? Try a recommended path.",
    explorePaths: "Explore paths",
    categories: "Categories",
    levels: "Levels",
    liveAcademy: "Live Academy",
    virtualAcademy: "Virtual Academy",
    inPersonClasses: "In‑person classes and experiences with instructors.",
    learnAtYourOwnPace: "Learn at your own pace with online courses and workshops.",
    danceCourses: "Dance Courses",
    musicCourses: "Music Courses",
    beginner: "Beginner",
    startHere: "Start here",
    intermediate: "Intermediate",
    advanced: "Advanced",
  } as const

const esTranslations: Record<keyof typeof enTranslations, string> = {
    // Generic
    back: "Volver",
    cancel: "Cancelar",
    continue: "Continuar",
    confirm: "Confirmar",
    myPanel: "Mi Panel",
    myCourses: "Mis Cursos",
    signIn: "Iniciar sesión",
    getInTouch: "Contactanos",
    assistantChatNote: "Centralizamos todo en el chat del asistente.",
    calendarsHint: "Seleccioná una fecha y hora para habilitar los calendarios.",
    booking: "Reserva",
    summary: "Resumen",
    service: "Servicio",
    package: "Paquete",
    extras: "Extras",
    people: "Personas",
    dateTime: "Fecha/Hora",
    email: "Email",
    total: "Total",
    demo: "demo",
    done: "Listo",
    reviewAndConfirm: "Revisá y confirmá",
    course: "Curso",
    name: "Nombre",
    paymentMethod: "Método de pago",
    notes: "Notas",
    estimatedTotal: "Total estimado",
    classWord: "Clase",

    // Steps
    step_party: "¿Venís con alguien?",
    step_datetime: "Fecha y hora",
    step_info: "Tus datos",
    step_payments: "Pagos",
    step_review: "Revisión y confirmación",

    // Form labels
    label_service: "Servicio",
    label_companion: "¿Venís acompañado/a?",
    onePerson: "persona",
    manyPeople: "personas",
    optionalPackages: "Paquetes opcionales",
    removeSelection: "Quitar selección",
    packagesHint: "Podés elegir un paquete o saltearlo. Es opcional.",
    or: "o",
    skipPackages: "Saltear paquetes y continuar",
    label_extras: "Extras",
    label_selectTime: "Elegí un horario",
    label_firstName: "Nombre",
    label_lastName: "Apellido",
    label_email: "Email",
    label_notes: "Notas",
    placeholder_firstName: "Ingresá tu nombre",
    placeholder_lastName: "Ingresá tu apellido",
    placeholder_email: "Ingresá tu email",
    placeholder_notes: "Algo que debamos saber…",
    phoneRemovedNote: "Teléfono removido. Pronto vas a poder continuar por el chat del asistente.",

    // Payments
    payments_summary: "Resumen",
    payments_classes: "Clases",
    payments_coupon: "Cupón:",
    payments_coupon_placeholder: "ej. PLI10",
    payments_remove: "Quitar",
    payments_add: "Agregar",
    payments_invalidCoupon: "Cupón inválido (usá PLI10 o PLI20 en el demo)",
    payments_totalAmount: "Monto total:",
    payments_method: "Método de pago",
    payments_onSite: "Efectivo",
    payments_onSite_desc: "Pagá en efectivo en la recepción.",
    payments_stripe: "Tarjeta",
    payments_stripe_desc: "Pagá con tarjeta.",
    new_student_single_notice: "El precio de alumno nuevo aplica solo para 1 persona.",
    new_student_verify_phone: "Verificá tu teléfono por SMS para acceder al precio de alumno nuevo.",
    verify_phone_cta: "Verificar teléfono ahora",
    account_exists_error: "Encontramos una cuenta existente con este email o teléfono.",
    account_exists_cta: "Iniciá sesión para continuar",
    account_exists_title: "Iniciá sesión para continuar",
    account_exists_signed_in: "No pudimos validar tu sesión todavía. Intentá de nuevo en un momento.",
    new_student_existing_error:
      "¿Un alumno que vuelve haciéndose el nuevo? Es broma. Vas a pagar el precio regular de la clase.",
    existing_customer_signin_required:
      "Este número de teléfono ya está registrado. Iniciá sesión para continuar.",
    identity_check_failed: "No pudimos verificar tu cuenta en este momento. Intentá de nuevo.",
    verifyingAccount: "Verificando...",
    account_exists_back: "Volver al formulario",
    sign_in_modal_title: "Iniciar sesión",
    sign_in_modal_subtitle: "Usá tu número de teléfono para continuar.",
    phone_format_hint: "Usá un número de teléfono válido (10 dígitos).",
    verify_phone_title: "Verificá tu teléfono",
    verify_phone_subtitle: "Usamos verificación por SMS para proteger el precio de alumno nuevo.",
    verify_phone_signed_out: "Iniciá sesión para verificar tu teléfono y continuar.",
    verify_phone_back: "Volver a cursos",

    // Success and calendar
    addToCalendar: "Agregar al calendario",
    congratulations: "¡Felicitaciones!",
    appointmentId: "Reserva #",
    date: "Fecha:",
    localTime: "Hora local:",
    teacher: "Profesor/a:",
    location: "Ubicación:",
    payment: "Pago:",
    customerPanel: "Panel del cliente",
    finish: "Finalizar",
    googleCal_details: "Reserva en PLI. Participantes: {participants}. Total demo: ${total}.",
    ics_description: "Reserva en PLI. Participantes: {participants}. Total (demo): ${total}.",

    // ARIA
    aria_close: "Cerrar",
    aria_dialog_bookingFor: "Reserva para {title}",
    aria_switchLanguage: "Cambiar idioma",

    // Header/assistant
    assistant_title: "¡Hola! Soy tu asistente. ¿En qué puedo ayudarte?",
    assistant_cta: "Iniciar chat",

    // Notification bar
    notif_announcement: "Aviso: las compras en las próximas 12 horas califican para ofertas y novedades especiales.",
    notif_close: "Cerrar notificación",
    notif_cta: "Ir al curso con descuento",

    // Search
    searchPlaceholder: "Buscar cursos…",
    aria_search: "Buscar",

    // Home hero
    hero_title: "Aprendé de los mejores, dá lo mejor de vos.",
    hero_subtitle: "Acceso ilimitado a miles de lecciones cortas.",
    hero_question: "¿Qué te trae hoy a Palladium Latin Institute?",

    // Course page
    courseNotFoundTitle: "Curso no encontrado",
    courseNotFoundBody: "Revisá el enlace o volvé al catálogo.",

    // Header/menu & navigation
    explore: "Explorar",
    notSureStart: "¿No sabés por dónde empezar? Probá un camino recomendado.",
    explorePaths: "Explorar caminos",
    categories: "Categorías",
    levels: "Niveles",
    liveAcademy: "Academia Presencial",
    virtualAcademy: "Academia Virtual",
    inPersonClasses: "Clases presenciales y experiencias con instructores.",
    learnAtYourOwnPace: "Aprendé a tu ritmo con cursos y talleres online.",
    danceCourses: "Cursos de Danza",
    musicCourses: "Cursos de Música",
    beginner: "Principiante",
    startHere: "Empezá acá",
    intermediate: "Intermedio",
    advanced: "Avanzado",
} as const

const translationsObj = {
  en: enTranslations,
  es: esTranslations,
} as const

export const translations = translationsObj
export type Translations = typeof translations
export type Dict = Translations[Locale]
export type I18nKey = keyof Translations["en"]
