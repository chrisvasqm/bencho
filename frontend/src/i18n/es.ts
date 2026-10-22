// Spanish copy: neutral Latin American Spanish, addressing the user as "tú".
// Same keys as en.ts; `<key>_advanced` is the Advanced mode wording.
//
// Glosario: run = ejecución · flow = flujo (los pasos) · step = paso · simulated user = usuario
// simulado · virtual user = usuario virtual (VU) · think time = pausa entre pasos · response time =
// tiempo de respuesta · errors = solicitudes que no recibieron la respuesta esperada
import type { Translation } from './en.ts';

export const es: Translation = {
  app: {
    backendDown: 'Bencho no puede conectarse a su servidor',
    backendDownHint: 'Inicia Bencho con docker compose up y luego recarga esta página.',
    backendDownHint_advanced: 'Inicia el stack con docker compose up y luego recarga.',
    runsTitle: 'Ejecuciones',
    runsDescription: 'Las más recientes primero. Selecciona una ejecución para ver sus resultados.',
    runsLoadError:
      'No se pudieron cargar las ejecuciones. Bencho lo intenta de nuevo en un momento.',
  },
  prefs: {
    language: 'Idioma',
    languages: { en: 'inglés', es: 'español' },
    switchLanguage: 'cambiar a {{language}}',
    theme: 'Tema',
    themes: { system: 'Sistema', light: 'Claro', dark: 'Oscuro' },
    detail: 'Nivel de detalle',
    detailHint:
      'Básico muestra los ajustes principales con palabras simples. Avanzado muestra todos los ajustes.',
    details: { basic: 'Básico', advanced: 'Avanzado' },
  },
  runType: { load: 'Carga', stress: 'Estrés', spike: 'Pico' },
  runTypeLower: { load: 'carga', stress: 'estrés', spike: 'pico' },
  runTypeDescription: {
    load: 'Tráfico normal y estable. Revisa que el sitio siga rápido en un día común.',
    load_advanced:
      'Tráfico estable y esperado. Confirma que la API cumple sus límites en un día normal.',
    stress:
      'Agrega cada vez más usuarios para encontrar el punto donde el sitio se pone lento o falla.',
    stress_advanced:
      'Sube más allá del tráfico normal para encontrar dónde empiezan a crecer la latencia o los errores.',
    spike:
      'Envía una ola repentina de usuarios y luego baja, para revisar que el sitio se recupere.',
    spike_advanced:
      'Salta a una ola de usuarios en segundos y luego baja, para revisar la recuperación.',
  },
  status: {
    queued: 'En espera',
    running: 'En curso',
    passed: 'Aprobada',
    failed: 'Fallida',
    error: 'Error',
    stopped: 'Detenida',
  },
  toast: {
    started: 'Prueba de {{typeLower}} iniciada',
    startedHint: 'Recibirás un mensaje cuando termine.',
    startFailed: 'La ejecución no se inició',
    deleted: 'Ejecución eliminada',
    deleteFailed: 'La ejecución no se eliminó',
    stopping: 'Deteniendo la prueba de {{typeLower}}…',
    stopFailed: 'La ejecución no se detuvo',
    bulkDeleted_one: '{{count}} ejecución eliminada',
    bulkDeleted_other: '{{count}} ejecuciones eliminadas',
    bulkDeleted_many: '{{count}} ejecuciones eliminadas',
    bulkSkipped_one: '{{count}} ejecución no se eliminó: sigue en curso o ya no existe.',
    bulkSkipped_other: '{{count}} ejecuciones no se eliminaron: siguen en curso o ya no existen.',
    bulkSkipped_many: '{{count}} ejecuciones no se eliminaron: siguen en curso o ya no existen.',
    bulkDeleteFailed: 'Las ejecuciones no se eliminaron',
    passed: 'Prueba de {{typeLower}} aprobada',
    passedHint: 'Tiempo de respuesta (95 %): {{value}}',
    passedHint_advanced: 'p95 {{value}}',
    failed: 'Prueba de {{typeLower}} fallida',
    failedHint: 'Se superó un límite. Abre la ejecución para ver cuál.',
    stopped: 'Prueba de {{typeLower}} detenida',
    stoppedHint: 'Se guardaron los resultados obtenidos hasta ahora.',
    couldNotFinish: 'La prueba de {{typeLower}} no pudo terminar',
  },
  errors: {
    validation: 'Bencho no aceptó uno de los valores. Revisa los ajustes e inténtalo de nuevo.',
    offline: 'Bencho no puede conectarse a su servidor. Revisa que Bencho esté en marcha.',
    TOO_MANY_RUNS:
      'Solo pueden correr {{max}} ejecuciones al mismo tiempo. Espera a que termine una.',
    RUN_NOT_FOUND: 'Esta ejecución ya no existe.',
    RUN_NOT_ACTIVE: 'Esta ejecución ya terminó.',
    RUN_IN_PROGRESS: 'Espera a que la ejecución termine antes de eliminarla.',
    TARGET_NOT_ALLOWED:
      'Esta dirección ({{host}}) está en una red privada, y Bencho está configurado para probar solo sitios públicos.',
    PAYLOAD_TOO_LARGE: 'Los ajustes son demasiado grandes para enviarlos. Acorta los cuerpos.',
    DATABASE_UNAVAILABLE: 'Bencho no puede conectarse a su base de datos. Inténtalo en un momento.',
    NOT_FOUND: 'Bencho no encontró lo que le pidió a su servidor. Recarga la página.',
    INTERNAL: 'Algo salió mal. Inténtalo de nuevo.',
    UNKNOWN: 'Bencho recibió una respuesta que no pudo leer. Inténtalo de nuevo.',
    BAD_REQUEST: 'Bencho no pudo leer la solicitud. Recarga la página e inténtalo de nuevo.',
  },
  panel: {
    title: 'Nueva ejecución',
    tabs: {
      setup: 'Ajustes',
      flow: 'Pasos',
      flow_advanced: 'Flujo',
      limits: 'Reglas',
      limits_advanced: 'Límites',
    },
    tabsLabel: 'Ajustes de la ejecución',
    loading: 'Cargando ajustes…',
    start: 'Iniciar prueba de {{typeLower}}',
    starting: 'Iniciando…',
    testType: 'Tipo de prueba',
    baseUrl: 'Dirección del sitio',
    baseUrl_advanced: 'URL base',
    baseUrlHint: 'La dirección del sitio o API que quieres probar. Cada paso le agrega su ruta.',
    baseUrlHint_advanced:
      'Los pasos de la pestaña Flujo envían sus solicitudes a rutas dentro de esta URL.',
    loadShape: 'Cuántos usuarios y cuándo',
    loadShape_advanced: 'Forma de la carga',
    targetsCount: 'Los objetivos cuentan',
    modes: { users: 'Usuarios', rate: 'Tasa' },
    modeHint: {
      users: 'Cada número es cuántos usuarios están activos al mismo tiempo.',
      users_advanced: 'Cada objetivo es un número de usuarios virtuales corriendo al mismo tiempo.',
      rate: 'Cada número es cuántas veces por segundo empiezan los pasos, con hasta 2 decimales (0.25 = una vez cada 4 segundos). Al cambiar, los números se mantienen, así que revísalos.',
      rate_advanced:
        'Cada objetivo es la cantidad de flujos iniciados por segundo, con hasta 2 decimales (0.25 = uno cada 4 segundos). Al cambiar, los números se mantienen, así que revísalos.',
    },
    stages: 'Etapas',
    duration: 'Duración',
    target: {
      users: 'Usuarios',
      users_advanced: 'Usuarios virtuales',
      rate: 'Inicios por segundo',
      rate_advanced: 'Flujos por segundo',
    },
    stageDuration: 'Duración de la etapa {{number}}',
    stageTarget: 'Etapa {{number}}: {{label}}',
    removeStage: 'Quitar la etapa {{number}}',
    addStage: 'Agregar etapa',
    maxUsers: 'Máximo de usuarios virtuales',
    maxUsersHint:
      'k6 agrega VUs hasta este número para mantener la tasa. Por encima, los flujos se descartan.',
    chartTitle: '{{label}} planeados',
    chartEmpty: 'Corrige las duraciones de las etapas para ver la forma.',
    shapeNoteTitle: 'Cómo funciona',
    shapeNoteTitle_advanced: 'Cómo funciona la forma de la carga',
    shapeNote1:
      'Cada usuario simulado sigue los pasos de la pestaña Pasos, uno tras otro, hace una pausa después de cada uno y vuelve a empezar hasta que termina la ejecución.',
    shapeNote1_advanced:
      'Un usuario virtual (VU) es un usuario simulado. Ejecuta los pasos de la pestaña Flujo en orden, espera después de cada paso (la espera aleatoria del paso, o la pausa entre pasos) y vuelve a empezar hasta que termina la ejecución. Cuando un paso falla, el VU espera, salta los pasos restantes y vuelve a empezar.',
    shapeNote2:
      'Las etapas corren en orden. Durante cada etapa, el número de usuarios cambia poco a poco hasta el número de la etapa. Por ejemplo, 30s → 20 y luego 1m → 20 agrega usuarios durante 30 segundos y luego mantiene 20 usuarios durante 1 minuto.',
    shapeNote2_advanced:
      'Las etapas corren en orden. Durante cada etapa, el número de VUs cambia de forma constante hasta el objetivo de la etapa. Por ejemplo, 30s → 20 VUs y luego 1m → 20 VUs agrega usuarios durante 30 segundos y luego mantiene 20 usuarios durante 1 minuto.',
    shapeNote3:
      'Usuarios cuenta usuarios simultáneos. Tasa cuenta flujos iniciados por segundo, sin importar qué tan lento se ponga el servidor: úsala para una meta como 50 inicios de sesión por segundo. Cada flujo envía una solicitud por paso.',
    thinkTime: 'Pausa entre pasos',
    thinkTime_advanced: 'Think time',
    thinkTimeHint:
      'Segundos que cada usuario espera después de un paso, como una persona leyendo la página.',
    thinkTimeHint_advanced: 'Segundos que espera un usuario después de cada paso sin espera propia',
    maxErrorRate: 'Errores permitidos (%)',
    maxErrorRate_advanced: 'Tasa de error máxima',
    maxErrorRateHint:
      'La ejecución falla si más solicitudes que esto reciben una respuesta incorrecta.',
    maxErrorRateHint_advanced: 'Porcentaje de solicitudes sin el estado esperado',
    gracePeriod: 'Periodo de gracia',
    gracePeriodHint:
      'Segundos que un usuario puede usar para terminar su flujo después de la última etapa (y, con Usuarios, cuando la forma de la carga lo quita). Pasado este tiempo, k6 corta el flujo.',
    latencyLimits: 'Límites de latencia (ms)',
    maxResponseTime: 'Tiempo de respuesta máximo (ms)',
    maxResponseTimeHint:
      '95 de cada 100 solicitudes deben responder más rápido que esto, o la ejecución falla.',
    percentileNoteTitle: '¿Qué significan p50, p90, p95 y p99?',
    percentileNote2:
      'p50 es la solicitud típica. p99 es la línea por encima de la cual está el 1 % más lento de las solicitudes. Un promedio esconde estas solicitudes lentas, por eso los límites usan percentiles.',
    failNoteTitle: '¿Cuándo falla una ejecución?',
  },
  validation: {
    baseUrl: 'Escribe una dirección completa, que empiece con http:// o https://',
    credentials: 'Pon el usuario y la contraseña en un encabezado, no en la dirección',
    durations: 'Escribe las duraciones así: 10s, 1m o 1h30m',
    targetUsers: 'Usa un número entero de usuarios, 0 o más',
    targetRate: 'Usa un número de 0 o más, con 2 decimales como máximo',
    maxStages: 'Usa {{max}} etapas como máximo',
    maxDuration: 'Todas las etapas juntas pueden durar 60 minutos como máximo',
    maxUsers: 'Usa un número entero de 1 o más',
    thinkTime: 'Usa un número de segundos, 0 o más',
    gracePeriod: 'Usa un número entero de segundos entre 0 y {{max}}',
    maxErrorRate: 'Usa un porcentaje entre 0 y 100',
    latency: 'Cada límite debe ser mayor que 0 ms',
    stepLabel: 'Paso {{number}} ({{name}})',
    untitled: 'Sin nombre',
  },
  flow: {
    intro: 'Cada usuario ejecuta estos pasos en orden, una y otra vez.',
    introUse: 'Usa',
    introAfter: 'o un valor que guarda un paso anterior, en la ruta, los encabezados o el cuerpo.',
    emptyPath: 'dirección del sitio',
    emptyPath_advanced: 'URL base',
    untitled: 'Sin nombre',
    hasProblem: 'tiene un problema',
    moveUp: 'Subir el paso {{number}}',
    moveDown: 'Bajar el paso {{number}}',
    remove: 'Quitar el paso {{number}}',
    add: 'Agregar paso',
    loadExample: 'Cargar el ejemplo de QuickPizza',
    loadSoapExample: 'Cargar el ejemplo SOAP',
    name: 'Nombre',
    status: 'Código de respuesta esperado',
    status_advanced: 'Estado',
    request: 'Solicitud',
    requestHint:
      'Elige qué hacer (GET lee, POST envía datos) y la ruta de la página, como /api/items. Deja la ruta vacía para usar la dirección del sitio.',
    requestHint_advanced:
      'Una ruta como /api/items/{{example}} se agrega a la URL base. Déjala vacía para usar la URL base.',
    method: 'Método',
    pathPlaceholder: 'Vacía: la dirección del sitio',
    pathPlaceholder_advanced: 'Vacía: la URL base',
    headers: 'Encabezados',
    header: 'Encabezado',
    value: 'Valor',
    addHeader: 'Agregar encabezado',
    format: 'Formato',
    formatLabel: 'Formato del cuerpo y de la respuesta',
    formatHint: {
      json: 'El cuerpo es JSON y los valores guardados vienen de la respuesta JSON.',
      soap: 'El cuerpo es XML y los valores guardados vienen de la respuesta XML. Los valores en {{example}} se escapan como texto XML.',
    },
    body: { json: 'Cuerpo JSON', soap: 'Cuerpo SOAP' },
    bodyHint: {
      json: 'Datos que se envían. Déjalo vacío si no hay.',
      json_advanced:
        'Déjalo vacío para no enviar cuerpo. Se envía como application/json salvo que un encabezado diga otra cosa.',
      soap: 'El mensaje SOAP que se envía. Déjalo vacío si no hay.',
      soap_advanced:
        'Déjalo vacío para no enviar cuerpo. Se envía como text/xml (SOAP 1.1) salvo que un encabezado diga otra cosa: para SOAP 1.2 pon Content-Type en application/soap+xml. Agrega un encabezado SOAPAction si el servicio lo necesita.',
    },
    wait: 'Espera después de este paso',
    waitHint:
      'Segundos, de 0 a {{max}}. Cada vez, el usuario espera un tiempo al azar en este rango, como una persona real que lee o escribe. Deja ambos vacíos para usar la pausa entre pasos.',
    waitHint_advanced:
      'Segundos, de 0 a {{max}}. Cada vez, el usuario espera un tiempo al azar en este rango, como una persona real que lee o escribe. Deja ambos vacíos para usar el think time.',
    shortest: 'Mínima',
    longest: 'Máxima',
    waitPlaceholder: 'Pausa',
    waitPlaceholder_advanced: 'Think time',
    save: 'Guardar de la respuesta',
    saveHint: {
      json: 'Los pasos siguientes usan un valor guardado como {{example}}. La ruta lee la respuesta JSON, por ejemplo <code>pizza.id</code> o <code>items.0.id</code>.',
      soap: 'Los pasos siguientes usan un valor guardado como {{example}}. La ruta nombra elementos de la respuesta XML, a cualquier profundidad y sin prefijos, por ejemplo <code>Token</code> o <code>LoginResponse.Token</code>. Un número elige uno entre varios: <code>Item.1.Id</code>.',
    },
    savePath: { json: 'Ruta JSON', soap: 'Ruta del elemento' },
    addValue: 'Agregar valor',
    removePair: 'Quitar {{label}} {{number}}',
    newStep: 'Nuevo paso',
  },
  flowProblem: {
    noSteps: 'Agrega al menos un paso',
    maxSteps: 'Usa {{max}} pasos como máximo',
    duplicateName: 'Otro paso tiene este nombre. Dale a cada paso su propio nombre.',
    noName: 'Dale un nombre al paso',
    nameLength: 'El nombre puede tener {{max}} caracteres como máximo',
    path: 'La ruta debe estar vacía, empezar con / o ser una dirección completa',
    status: 'El código de respuesta esperado debe ser un estado HTTP, como 200',
    pathLength: 'La ruta puede tener {{max}} caracteres como máximo',
    maxHeaders: 'Usa {{max}} encabezados como máximo',
    duplicateHeader: 'Cada nombre de encabezado se puede usar una sola vez',
    headerNoName: 'Cada encabezado necesita un nombre',
    badHeaderName: '"{{name}}" no es un nombre de encabezado válido',
    headerLength: 'Un valor de encabezado puede tener {{max}} caracteres como máximo',
    headerLineBreak: 'Los valores de encabezado no pueden tener saltos de línea',
    unknownPlaceholder: '{{placeholder}} no viene incluido y ningún paso anterior lo guarda',
    bodyLength: 'El cuerpo puede tener {{max}} caracteres como máximo',
    xml: 'El cuerpo debe ser XML bien formado',
    json: 'El cuerpo debe ser JSON válido',
    waitRange: 'Pon la espera mínima y máxima como números de 0 a {{max}}, o deja ambas vacías',
    waitOrder: 'La espera máxima debe ser al menos igual a la mínima',
    maxSaves: 'Guarda {{max}} valores como máximo',
    badSaveName: '"{{name}}" no puede ser el nombre de un valor guardado',
    pathName: { json: 'ruta JSON', soap: 'ruta del elemento' },
    savePath: 'Cada valor guardado necesita su {{path}}',
    savePathLength: 'La {{path}} puede tener {{max}} caracteres como máximo',
  },
  capacity: {
    title: 'Cuántos usuarios puede simular esta computadora',
    title_advanced: 'Cuántos VUs puede correr el servidor de Bencho',
    estimate:
      'Estimación aproximada: unos {{estimate}} usuarios al mismo tiempo, según la memoria libre de la computadora donde corre Bencho.',
    estimate_advanced:
      'Estimación aproximada: unos {{estimate}} VUs. El servidor de Bencho tiene {{memory}} GB de memoria libre y {{cpus}} núcleos de CPU, y k6 usa hasta unos {{perUser}} MB por VU. Los flujos largos, los cuerpos grandes, las pausas cortas y otras ejecuciones activas bajan este número.',
    docker:
      'En Docker Desktop, el límite depende de la memoria que le das a Docker en su configuración.',
    docker_advanced:
      'En Docker Desktop, la memoria libre viene del límite de memoria de Docker (Settings → Resources → Advanced → Memory limit), que comparten todos los contenedores en marcha, no de toda la memoria de la computadora. Un mem_limit en el contenedor del backend también la reduce.',
    warning:
      'Pediste {{value}} usuarios, más que la estimación de {{estimate}}. La ejecución puede volver lenta o detener esta computadora.',
    warningRate:
      'El máximo de usuarios virtuales es {{value}} VUs, más que la estimación de {{estimate}}. La ejecución puede volver lento o detener el servidor.',
    warning_advanced:
      'Tus etapas llegan a {{value}} VUs, más que la estimación de {{estimate}}. La ejecución puede volver lento o detener el servidor.',
  },
  runs: {
    empty: 'Todavía no hay ejecuciones de este tipo. Inicia una desde el panel.',
    selectAll: 'Seleccionar todas las ejecuciones terminadas de esta página',
    selectRun: 'Seleccionar la ejecución del {{time}}',
    openRun: '{{status}}, ejecución del {{time}}',
    headers: {
      status: 'Resultado',
      status_advanced: 'Estado',
      target: 'Dirección',
      target_advanced: 'Destino',
      peak: 'Pico',
      p95: 'Tiempo de respuesta',
      p95_advanced: 'p95',
      errors: 'Errores',
      started: 'Inicio',
    },
    bulkSelected: '{{count}} seleccionadas',
    bulkClear: 'Limpiar',
    bulkDelete: 'Eliminar',
    bulkConfirm_one: 'Eliminar {{count}} ejecución',
    bulkConfirm_other: 'Eliminar {{count}} ejecuciones',
    bulkConfirm_many: 'Eliminar {{count}} ejecuciones',
    unitUsers_one: '{{count}} usuario',
    unitUsers_other: '{{count}} usuarios',
    unitUsers_many: '{{count}} usuarios',
    unitUsers_advanced_one: '{{count}} VU',
    unitUsers_advanced_other: '{{count}} VUs',
    unitUsers_advanced_many: '{{count}} VUs',
    unitRate: '{{count}}/s',
  },
  pagination: {
    label: 'Páginas',
    none: 'Sin ejecuciones',
    range: '{{first}}–{{last}} de {{total}}',
    previous: 'Anterior',
    next: 'Siguiente',
    page: 'Página {{page}} de {{count}}',
  },
  active: {
    title: 'Ejecuciones en curso',
    count_one: '{{count}} ejecución en curso',
    count_other: '{{count}} ejecuciones en curso',
    count_many: '{{count}} ejecuciones en curso',
    progress: 'Progreso de la ejecución de {{typeLower}}',
  },
  detail: {
    title: 'Ejecución de {{typeLower}} · {{time}}',
    stop: 'Detener',
    stopConfirm: 'Detener ejecución',
    delete: 'Eliminar',
    deleteConfirm: 'Eliminar ejecución',
    keep: 'Conservar',
    rateCap_one: 'tasa, hasta {{count}} VU',
    rateCap_many: 'tasa, hasta {{count}} VUs',
    rateCap_other: 'tasa, hasta {{count}} VUs',
    dropped_one: '{{count}} flujo descartado (todos los VUs ocupados)',
    dropped_other: '{{count}} flujos descartados (todos los VUs ocupados)',
    dropped_many: '{{count}} flujos descartados (todos los VUs ocupados)',
    steps_one: '{{count}} paso',
    steps_other: '{{count}} pasos',
    steps_many: '{{count}} pasos',
    pauses: 'pausa de {{think}}s entre pasos',
    pauses_advanced: 'think time {{think}}s, gracia {{grace}}s',
    ownWaits: ', algunos pasos esperan su propio rango',
    took: 'duró {{seconds}}s',
    responseTime: 'Tiempo de respuesta (95 %)',
    errorRate: 'Errores',
    errorRate_advanced: 'Tasa de error',
    requests: 'Solicitudes',
    readTitle: 'Cómo leer estos números',
    read1:
      'Verde significa que cumple su regla, rojo que no la cumplió. Tiempo de respuesta (95 %): 95 de cada 100 solicitudes respondieron dentro de este tiempo.',
    read1_advanced:
      'Verde significa por debajo de su límite, rojo que llegó al límite. p50, p90, p95 y p99: un percentil del tiempo de respuesta. Un p95 de 300 ms significa que 95 de cada 100 solicitudes tardaron 300 ms o menos; las 5 más lentas tardaron más.',
    read2:
      'Errores es la parte de las solicitudes que no recibió la respuesta esperada. Solicitudes es cuántas se enviaron en total, con el promedio por segundo.',
    read2_advanced:
      'La tasa de error es la parte de las solicitudes que no recibió el estado que espera su paso. Solicitudes es el total enviado, con el promedio por segundo.',
    waiting:
      'Los resultados aparecen cuando termina la ejecución. Los gráficos de abajo se actualizan cada 2 segundos.',
    noTotals: 'No se registraron resultados.',
  },
  explain: {
    percentile:
      'Un percentil del tiempo de respuesta. Un p95 de 300 ms significa que 95 de cada 100 solicitudes tardaron 300 ms o menos; las 5 más lentas tardaron más.',
    errorRate:
      'La tasa de error es la parte de las solicitudes que no recibió el estado que espera su paso.',
    failRule:
      'Una ejecución falla cuando las solicitudes son demasiado lentas, cuando demasiadas reciben una respuesta incorrecta, o cuando los pasos no pueden guardar los valores que necesitan.',
    failRule_advanced:
      'Una ejecución falla cuando algún valor de latencia llega a su límite (cada uno debe quedar por debajo), cuando la tasa de error llega al máximo, o cuando pasa el 99 % o menos de las comprobaciones. Las comprobaciones confirman que cada paso recibió su estado esperado y guardó sus valores, así que una ejecución puede fallar con 0 % de errores. Una ejecución por tasa también falla cuando descarta más flujos planeados de los que permite la tasa de error máxima.',
  },
  failures: {
    title: 'Respuestas fallidas (ejemplos)',
    title_advanced: 'Respuestas fallidas (muestra)',
    hint: 'Ejemplos de lo que respondió el sitio cuando falló un paso. No aparecen todos los fallos.',
    hint_advanced:
      'Los cuerpos se leen en 1 de cada 20 flujos, y en todos los flujos de los pasos que guardan valores, así que son ejemplos, no todos los fallos. Una respuesta exitosa (2xx) muestra solo sus claves JSON (o nombres de elementos XML), porque puede contener tokens. Cada paso muestra hasta 10 respuestas distintas, como máximo 3 por estado.',
    extract: 'estado {{status}}, faltó un valor para guardar',
    network: 'sin respuesta (error de red)',
    status: 'estado {{status}}',
    statusExpected: 'estado {{status}}, se esperaba {{expected}}',
    emptyBody: '(cuerpo vacío)',
  },
  charts: {
    label: 'Gráficos de la ejecución',
    tabs: {
      latency: 'Tiempo de respuesta',
      latency_advanced: 'Latencia',
      load: 'Carga',
      errors: 'Errores',
    },
    waiting: 'Esperando los primeros segundos de resultados…',
    none: 'No hay resultados por segundo para esta ejecución.',
    latencyTitle: 'Tiempo de respuesta por segundo',
    rateTitle: 'Flujos por segundo',
    planned: 'Planeados',
    finished: 'Terminados',
    dropped: 'Descartados',
    users: 'Usuarios',
    users_advanced: 'Usuarios virtuales',
    requestsTitle: 'Solicitudes por segundo',
    requests: 'Solicitudes/s',
    errorsTitle: 'Solicitudes fallidas (parte de cada segundo)',
    errorRate: 'Errores',
    errorRate_advanced: 'Tasa de error',
    noteLatency:
      'Cada punto es un segundo de la ejecución. Las líneas muestran cuánto tardaron las solicitudes en responder. Si las líneas suben a medida que se agregan usuarios, el sitio se está volviendo lento.',
    noteLatency_advanced:
      'Cada punto es un segundo de la ejecución. Cada línea muestra un percentil (p50, p90, p95, p99) de las solicitudes que terminaron en ese segundo: p95 es el tiempo que no superaron 95 de cada 100. Con pocas solicitudes en un segundo, p90, p95 y p99 suelen ser iguales a la más lenta. Si las líneas suben a medida que se agregan usuarios, la API se está volviendo lenta.',
    noteLoad:
      'Usuarios es cuántos usuarios simulados estaban activos. Solicitudes por segundo es cuántas solicitudes enviaron. Si los usuarios siguen subiendo pero las solicitudes por segundo dejan de subir, el sitio llegó a su límite.',
    noteLoad_advanced:
      'Usuarios virtuales es cuántos usuarios simulados estaban corriendo. Solicitudes por segundo es cuántas solicitudes enviaron. Si los usuarios siguen subiendo pero las solicitudes por segundo dejan de subir, la API llegó a su límite.',
    noteRate:
      'Flujos por segundo compara la tasa planeada con los flujos que terminaron y los que k6 descartó porque todos los VUs permitidos estaban ocupados. Un flujo cuenta en el segundo en que termina, así que Terminados va detrás de Planeados por lo que dura un flujo.',
    noteErrors:
      'La parte de las solicitudes de cada segundo que no recibió la respuesta esperada. Si los errores empiezan cuando la carga llega a su pico, el sitio no aguanta esa carga.',
    noteErrors_advanced:
      'La parte de las solicitudes de cada segundo que no recibió el estado que espera su paso. Si los errores empiezan cuando la carga llega a su pico, la API no aguanta esa carga.',
  },
};
