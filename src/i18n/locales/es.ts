import type { Translations } from './en';

export const es: Translations = {
  app: {
    brand: 'Bisbi',
    tabs: {
      home: 'Inicio',
      settings: 'Ajustes',
    },
    status: {
      idle: 'Listo',
      recording: 'Grabando',
      transcribing: 'Transcribiendo',
    },
    loading: 'Cargando…',
    notElectron: {
      body: 'Esta ventana tiene que abrirse desde Electron para que funcionen el hotkey global, el micrófono y la transcripción.',
      devHint:
        'Si estás en desarrollo, corré {cmd} en la raíz del repo y dejá que Electron abra su propia ventana. No abras {url} directamente en el browser.',
    },
    micError:
      'No se pudo acceder al micrófono. Asegurate de que Bisbi tenga permiso en los ajustes del sistema.',
    pythonMissing: 'Se necesita Python para transcribir localmente. Instalalo y revisá Ajustes.',
    enginePackageMissing: 'Terminá la configuración única del motor en Ajustes para habilitar la transcripción.',
    ffmpegMissing: 'Se necesita ffmpeg para transcribir localmente. Instalalo y revisá Ajustes.',
    modelMissing: 'Descargá un modelo en Ajustes para habilitar la transcripción.',
    engineError: 'La transcripción falló. Revisá el estado del motor en Ajustes.',
  },
  home: {
    greeting: {
      lateNight: 'Buenas noches',
      morning: 'Buen día',
      afternoon: 'Buenas tardes',
      evening: 'Buenas noches',
    },
    statusTitle: {
      idle: 'Listo para escuchar',
      recording: 'Grabando ahora',
      transcribing: 'Transcribiendo',
    },
    watermark: {
      idle: 'Listo para escucharte',
      listening: 'Escuchando',
      transcribing: 'Transcribiendo',
    },
    titleHint: 'Apretá el atajo y hablá.',
    hotkeyLabel: 'Atajo',
    hotkeyHintPaste: 'El texto se pega automáticamente donde estés escribiendo.',
  },
  settings: {
    hotkey: {
      title: 'Atajo de teclado',
      description: 'Atajo global para grabar.',
      change: 'Cambiar',
      cancel: 'Cancelar',
      waiting: 'Apretá las teclas que querés usar…',
    },
    handsFree: {
      title: 'Modo de grabación',
      description: 'Comportamiento del atajo.',
      pushToTalk: {
        label: 'Apretar para hablar',
        hint: 'Dejás apretado el atajo mientras hablás y lo soltás para que se detenga.',
      },
      tapToToggle: {
        label: 'Manos libres',
        hint: 'Tocás el atajo una vez para empezar a grabar y lo tocás de nuevo para detener. Ideal para dictados largos en los que no querés tener una tecla apretada.',
      },
      doubleTapNotice:
        '¿Querés pasar a manos libres sobre la marcha? Hacé un doble toque rápido a {hotkey} y la grabación queda fija para que puedas soltar la tecla.',
    },
    microphone: {
      title: 'Micrófono',
      description: 'Entrada de audio. Si falla, usamos la del sistema.',
      systemDefault: 'Predeterminado del sistema',
      unnamed: 'Micrófono {index}',
    },
    engine: {
      title: 'Motor de transcripción',
      description:
        'Corre 100% local con el paquete oficial openai-whisper de OpenAI (github.com/openai/whisper) — sin motores de terceros, sin nube. Necesita Python 3 en esta computadora.',
      pythonFound: 'Python {version} encontrado',
      pythonMissing: 'Python no encontrado',
      packageInstalled: 'openai-whisper instalado',
      packageMissing: 'openai-whisper no instalado',
      ffmpegInstalled: 'ffmpeg encontrado',
      ffmpegMissing: 'ffmpeg no encontrado',
      install: 'Instalar',
      installing: 'Instalando…',
    },
    whisperModel: {
      title: 'Modelo',
      description:
        'Checkpoint oficial de OpenAI Whisper para transcribir. Los modelos más grandes son más precisos pero más lentos y pesados de descargar.',
      active: 'En uso',
      use: 'Usar',
      download: 'Descargar',
    },
    transcriptionLanguage: {
      title: 'Idioma de la transcripción',
      description: 'Idioma en el que se devuelve la transcripción.',
      auto: 'Detección automática',
      unsupportedHint: 'El modelo seleccionado es solo en inglés y siempre transcribe en inglés.',
      search: 'Buscar idiomas…',
    },
    uiLanguage: {
      title: 'Idioma de la app',
      description: 'Idioma de la interfaz.',
      system: 'Sistema ({detected})',
    },
    openAtLogin: {
      title: 'Iniciar al encender',
      description: 'Abrir Bisbi al encender la computadora.',
      enabled: {
        label: 'Sí',
        hint: 'Bisbi arranca en segundo plano al iniciar sesión.',
      },
      disabled: {
        label: 'No',
        hint: 'Tenés que abrir Bisbi manualmente.',
      },
    },
    muteAudio: {
      title: 'Silenciar audio del sistema al grabar',
      description: 'Silenciar la salida del sistema mientras grabás.',
      enabled: {
        label: 'Sí',
        hint: 'Silencia la salida mientras dictás; restaura el volumen al parar.',
      },
      disabled: {
        label: 'No',
        hint: 'El volumen queda igual.',
      },
    },
    dangerZone: {
      title: 'Restablecer y datos',
      description: 'Acciones permanentes.',
    },
    reset: 'Restablecer ajustes',
    confirmReset: '¿Restablecer todos los ajustes a sus valores por defecto?',
  },
  recording: {
    recording: 'Grabando',
    transcribing: 'Transcribiendo…',
    idle: 'Listo',
  },
  uiLanguageOption: {
    en: 'English',
    es: 'Español',
    zh: '中文',
    hi: 'हिन्दी',
    ar: 'العربية',
  },
  keys: {
    command: 'Comando',
    leftCommand: 'Comando izquierdo',
    rightCommand: 'Comando derecho',
    control: 'Control',
    leftControl: 'Control izquierdo',
    rightControl: 'Control derecho',
    option: 'Opción',
    leftOption: 'Opción izquierda',
    rightOption: 'Opción derecha',
    alt: 'Alt',
    leftAlt: 'Alt izquierdo',
    rightAlt: 'Alt derecho',
    shift: 'Mayús',
    leftShift: 'Mayús izquierdo',
    rightShift: 'Mayús derecho',
    win: 'Win',
    leftWin: 'Win izquierdo',
    rightWin: 'Win derecho',
    ctrl: 'Ctrl',
    leftCtrl: 'Ctrl izquierdo',
    rightCtrl: 'Ctrl derecho',
    space: 'Espacio',
    capsLock: 'Bloq Mayús',
    shortLeft: 'I',
    shortRight: 'D',
  },
  tray: {
    tooltipIdle: 'Bisbi — listo para dictar',
    tooltipRecording: 'Bisbi — grabando…',
    tooltipTranscribing: 'Bisbi — transcribiendo…',
    openSettings: 'Abrir ajustes',
    quit: 'Salir',
  },
  errors: {
    hotkeyRegister: 'No se pudo registrar el atajo "{accel}". Probá otro.',
  },
  common: {
    yes: 'Sí',
    no: 'No',
  },
  onboarding: {
    progress: '{current} de {total}',
    back: 'Atrás',
    skip: 'Saltar',
    welcome: {
      title: 'Escribís lento. Hablar es 3× más rápido.',
      subtitle:
        'Bisbi convierte tu voz en texto en cualquier app — en menos de 2 segundos.',
      cta: 'Empezar',
    },
    permissions: {
      title: 'Bisbi necesita dos permisos.',
      subtitle: 'Sin estos, no puede funcionar.',
      grant: 'Otorgar permisos',
      continue: 'Siguiente',
      openSettings: 'Abrir Ajustes del Sistema',
      microphone: {
        title: 'Micrófono',
        description:
          'Para escucharte cuando hables. Tu audio nunca sale de tu computadora.',
        deniedHint: 'No pudimos acceder al micrófono.',
      },
      accessibility: {
        title: 'Accesibilidad',
        description:
          'Para escribir el texto donde tengas el cursor, en cualquier app.',
        deniedHint: 'No pudimos obtener acceso de accesibilidad.',
      },
    },
    hotkey: {
      title: '¿Con qué tecla querés activar Bisbi?',
      subtitle: 'Mantenela presionada para hablar. Soltala cuando termines.',
      recommended: 'Recomendada',
      custom: 'Personalizar…',
      pickOne: 'Elegí un atajo',
      confirm: 'Siguiente',
      conflictInUse: 'Esa combinación ya está en uso. Probá otra.',
      conflictInvalid: 'Esa combinación no está soportada. Probá otra.',
    },
    dictation: {
      title: 'Tu primer dictado.',
      subtitle: 'Mantené {hotkey} presionado y leé esto:',
      samplePhrase:
        'Reunión con el equipo el lunes a las 10. Traer el deck de ventas.',
      waiting: 'Esperando tu voz…',
      listening: 'Escuchando…',
      transcribing: 'Transcribiendo…',
      silenceError: 'No te escucho. ¿Está conectado tu micrófono?',
      failedError: 'No pudimos transcribir. Probá de nuevo.',
      continue: 'Continuar',
    },
  },
};
