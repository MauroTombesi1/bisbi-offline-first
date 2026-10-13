import type { Translations } from './en';

export const hi: Translations = {
  app: {
    brand: 'Bisbi',
    tabs: {
      home: 'होम',
      settings: 'सेटिंग्स',
    },
    status: {
      idle: 'तैयार',
      recording: 'रिकॉर्डिंग',
      transcribing: 'ट्रांसक्राइब हो रहा है',
    },
    loading: 'लोड हो रहा है…',
    notElectron: {
      body: 'ग्लोबल हॉटकी, माइक्रोफ़ोन और ट्रांसक्रिप्शन काम करने के लिए यह विंडो Electron से खोली जानी चाहिए।',
      devHint:
        'अगर आप डेवलपमेंट में हैं, तो रेपो की जड़ में {cmd} चलाएँ और Electron को अपनी विंडो खोलने दें। ब्राउज़र में सीधे {url} न खोलें।',
    },
    micError:
      'माइक्रोफ़ोन तक पहुँच नहीं हो सकी। सुनिश्चित करें कि Bisbi को सिस्टम सेटिंग्स में अनुमति प्राप्त है।',
    pythonMissing: 'लोकल ट्रांसक्रिप्शन के लिए Python चाहिए। इसे इंस्टॉल करें और सेटिंग्स देखें।',
    enginePackageMissing: 'ट्रांसक्रिप्शन चालू करने के लिए सेटिंग्स में एक बार का इंजन सेटअप पूरा करें।',
    ffmpegMissing: 'लोकल ट्रांसक्रिप्शन के लिए ffmpeg चाहिए। इसे इंस्टॉल करें और सेटिंग्स देखें।',
    modelMissing: 'ट्रांसक्रिप्शन चालू करने के लिए सेटिंग्स में एक मॉडल डाउनलोड करें।',
    engineError: 'ट्रांसक्रिप्शन विफल हुआ। सेटिंग्स में इंजन की स्थिति जाँचें।',
  },
  home: {
    greeting: {
      lateNight: 'शुभ रात्रि',
      morning: 'सुप्रभात',
      afternoon: 'नमस्कार',
      evening: 'शुभ संध्या',
    },
    statusTitle: {
      idle: 'सुनने के लिए तैयार',
      recording: 'अभी रिकॉर्ड हो रहा है',
      transcribing: 'ट्रांसक्राइब हो रहा है',
    },
    watermark: {
      idle: 'आपको सुनने के लिए तैयार',
      listening: 'सुन रहा है',
      transcribing: 'ट्रांसक्राइब हो रहा है',
    },
    titleHint: 'हॉटकी दबाएँ और बोलें।',
    hotkeyLabel: 'हॉटकी',
    hotkeyHintPaste: 'जहाँ आप टाइप कर रहे हैं, वहाँ टेक्स्ट अपने आप पेस्ट हो जाता है।',
  },
  settings: {
    hotkey: {
      title: 'कीबोर्ड शॉर्टकट',
      description: 'रिकॉर्ड करने के लिए ग्लोबल शॉर्टकट।',
      change: 'बदलें',
      cancel: 'रद्द करें',
      waiting: 'जो कुंजियाँ इस्तेमाल करना चाहते हैं उन्हें दबाएँ…',
    },
    handsFree: {
      title: 'रिकॉर्डिंग मोड',
      description: 'शॉर्टकट का व्यवहार।',
      pushToTalk: {
        label: 'पुश-टू-टॉक',
        hint: 'बोलते समय शॉर्टकट दबाए रखें; छोड़ने पर रुक जाएगा।',
      },
      tapToToggle: {
        label: 'हैंड्स-फ्री',
        hint: 'शुरू करने के लिए एक बार टैप करें, बंद करने के लिए दोबारा टैप करें।',
      },
      doubleTapNotice:
        '{hotkey} को तेज़ी से डबल-टैप करें और रिकॉर्डिंग चालू रहेगी ताकि आप कुंजी छोड़ सकें।',
    },
    microphone: {
      title: 'माइक्रोफ़ोन',
      description: 'ऑडियो इनपुट। उपलब्ध न होने पर सिस्टम डिफ़ॉल्ट पर लौटता है।',
      systemDefault: 'सिस्टम डिफ़ॉल्ट',
      unnamed: 'माइक्रोफ़ोन {index}',
    },
    engine: {
      title: 'ट्रांसक्रिप्शन इंजन',
      description:
        'यह पूरी तरह इसी कंप्यूटर पर, OpenAI के आधिकारिक openai-whisper पैकेज (github.com/openai/whisper) के साथ चलता है — कोई थर्ड-पार्टी इंजन नहीं, कोई क्लाउड नहीं। इस कंप्यूटर पर Python 3 चाहिए।',
      pythonFound: 'Python {version} मिला',
      pythonMissing: 'Python नहीं मिला',
      packageInstalled: 'openai-whisper इंस्टॉल है',
      packageMissing: 'openai-whisper इंस्टॉल नहीं है',
      ffmpegInstalled: 'ffmpeg मिला',
      ffmpegMissing: 'ffmpeg नहीं मिला',
      install: 'इंस्टॉल करें',
      installing: 'इंस्टॉल हो रहा है…',
    },
    whisperModel: {
      title: 'मॉडल',
      description:
        'ट्रांसक्राइब करने के लिए आधिकारिक OpenAI Whisper चेकपॉइंट। बड़े मॉडल ज़्यादा सटीक होते हैं लेकिन धीमे और डाउनलोड में भारी होते हैं।',
      active: 'उपयोग में',
      use: 'उपयोग करें',
      download: 'डाउनलोड करें',
    },
    transcriptionLanguage: {
      title: 'ट्रांसक्रिप्शन भाषा',
      description: 'जिस भाषा में ट्रांसक्रिप्शन वापस मिलेगा।',
      auto: 'ऑटो-डिटेक्ट',
      unsupportedHint: 'चुना गया मॉडल केवल अंग्रेज़ी के लिए है और हमेशा अंग्रेज़ी में ट्रांसक्राइब करता है।',
      search: 'भाषाएं खोजें…',
    },
    uiLanguage: {
      title: 'ऐप भाषा',
      description: 'इंटरफ़ेस की भाषा।',
      system: 'सिस्टम ({detected})',
    },
    openAtLogin: {
      title: 'स्टार्टअप पर लॉन्च करें',
      description: 'सिस्टम स्टार्टअप पर Bisbi खोलें।',
      enabled: {
        label: 'चालू',
        hint: 'लॉग इन करने पर Bisbi पृष्ठभूमि में शुरू होगा।',
      },
      disabled: {
        label: 'बंद',
        hint: 'आपको Bisbi को मैन्युअल रूप से खोलना होगा।',
      },
    },
    muteAudio: {
      title: 'रिकॉर्डिंग के दौरान सिस्टम ऑडियो म्यूट करें',
      description: 'रिकॉर्डिंग के दौरान सिस्टम आउटपुट म्यूट करें।',
      enabled: {
        label: 'चालू',
        hint: 'बोलते समय आउटपुट म्यूट होता है; रुकने पर बहाल हो जाता है।',
      },
      disabled: {
        label: 'बंद',
        hint: 'आउटपुट उसी स्तर पर रहता है।',
      },
    },
    dangerZone: {
      title: 'रीसेट और डेटा',
      description: 'स्थायी क्रियाएँ।',
    },
    reset: 'सेटिंग्स रीसेट करें',
    confirmReset: 'सभी सेटिंग्स को डिफ़ॉल्ट पर रीसेट करें?',
  },
  recording: {
    recording: 'रिकॉर्डिंग',
    transcribing: 'ट्रांसक्राइब हो रहा है…',
    idle: 'तैयार',
  },
  uiLanguageOption: {
    en: 'English',
    es: 'Español',
    zh: '中文',
    hi: 'हिन्दी',
    ar: 'العربية',
  },
  keys: {
    command: 'Command',
    leftCommand: 'बायाँ Command',
    rightCommand: 'दायाँ Command',
    control: 'Control',
    leftControl: 'बायाँ Control',
    rightControl: 'दायाँ Control',
    option: 'Option',
    leftOption: 'बायाँ Option',
    rightOption: 'दायाँ Option',
    alt: 'Alt',
    leftAlt: 'बायाँ Alt',
    rightAlt: 'दायाँ Alt',
    shift: 'Shift',
    leftShift: 'बायाँ Shift',
    rightShift: 'दायाँ Shift',
    win: 'Win',
    leftWin: 'बायाँ Win',
    rightWin: 'दायाँ Win',
    ctrl: 'Ctrl',
    leftCtrl: 'बायाँ Ctrl',
    rightCtrl: 'दायाँ Ctrl',
    space: 'स्पेस',
    capsLock: 'कैप्स लॉक',
    shortLeft: 'बा',
    shortRight: 'दा',
  },
  tray: {
    tooltipIdle: 'Bisbi — श्रुतलेख के लिए तैयार',
    tooltipRecording: 'Bisbi — रिकॉर्डिंग…',
    tooltipTranscribing: 'Bisbi — ट्रांसक्राइब हो रहा है…',
    openSettings: 'सेटिंग्स खोलें',
    quit: 'बाहर निकलें',
  },
  errors: {
    hotkeyRegister: 'शॉर्टकट "{accel}" को रजिस्टर नहीं किया जा सका। कोई और आज़माएँ।',
  },
  common: {
    yes: 'हाँ',
    no: 'नहीं',
  },
  onboarding: {
    progress: '{current} / {total}',
    back: 'वापस',
    skip: 'छोड़ें',
    welcome: {
      title: 'आप धीरे टाइप करते हैं। बोलना 3× तेज़ है।',
      subtitle:
        'Bisbi किसी भी ऐप में आपकी आवाज़ को टेक्स्ट में बदलता है — 2 सेकंड से कम में।',
      cta: 'शुरू करें',
    },
    permissions: {
      title: 'Bisbi को दो अनुमतियाँ चाहिए।',
      subtitle: 'इनके बिना यह काम नहीं कर सकता।',
      grant: 'अनुमति दें',
      continue: 'अगला',
      openSettings: 'सिस्टम सेटिंग्स खोलें',
      microphone: {
        title: 'माइक्रोफ़ोन',
        description:
          'जब आप बोलें तो हम सुन सकें। आपकी आवाज़ कभी आपके कंप्यूटर से बाहर नहीं जाती।',
        deniedHint: 'माइक्रोफ़ोन तक पहुँच नहीं हो सकी।',
      },
      accessibility: {
        title: 'एक्सेसिबिलिटी',
        description:
          'ताकि Bisbi किसी भी ऐप में, जहाँ आपका कर्सर है वहाँ टेक्स्ट टाइप कर सके।',
        deniedHint: 'एक्सेसिबिलिटी अनुमति नहीं मिल सकी।',
      },
    },
    hotkey: {
      title: 'Bisbi चालू करने के लिए कौन-सी कुंजी?',
      subtitle: 'बोलने के लिए दबाए रखें। पूरा होने पर छोड़ दें।',
      recommended: 'अनुशंसित',
      custom: 'कस्टम…',
      pickOne: 'कोई शॉर्टकट चुनें',
      confirm: 'अगला',
      conflictInUse: 'यह संयोजन पहले से उपयोग में है। दूसरा आज़माएँ।',
      conflictInvalid: 'यह संयोजन समर्थित नहीं है। दूसरा आज़माएँ।',
    },
    dictation: {
      title: 'आपका पहला डिक्टेशन।',
      subtitle: '{hotkey} दबाए रखें और इसे ज़ोर से पढ़ें:',
      samplePhrase:
        'सोमवार को 10 बजे टीम के साथ मीटिंग। सेल्स डेक साथ लाएँ।',
      waiting: 'आपकी आवाज़ का इंतज़ार…',
      listening: 'सुन रहे हैं…',
      transcribing: 'ट्रांसक्राइब हो रहा है…',
      silenceError: 'आवाज़ नहीं आ रही। क्या आपका माइक्रोफ़ोन जुड़ा है?',
      failedError: 'ट्रांसक्राइब नहीं हो सका। फिर से कोशिश करें।',
      continue: 'जारी रखें',
    },
  },
};
