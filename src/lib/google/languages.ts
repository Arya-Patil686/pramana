/*
   The languages PRAMĀNA speaks, and the pre-approved public-health messages
   it speaks in them.

   Two deliberate choices here.

   First, protective health advice is served from a reviewed phrasebook rather
   than generated per request. Real public-health systems work this way, and
   for a good reason: a model improvising medical instruction in a language no
   reviewer on the team reads is an unacceptable failure mode. Gemini writes
   the situational narrative; the phrasebook carries the instruction to the
   public. Translation API handles everything dynamic in between.

   Second, the list is corridor-scoped, not national. A Punjab-Delhi episode
   speaks Punjabi, Hindi, Urdu and English because those are the languages
   spoken along that corridor. Adding a corridor adds its languages; nobody
   ships fourteen translations to a district that needs three.
*/

export interface LanguageSpec {
  /** BCP-47 code, as Cloud Translation and Text-to-Speech both expect. */
  code: string;
  /** Endonym — what speakers call it. Shown in the picker. */
  native: string;
  english: string;
  /** Voice locale for Cloud Text-to-Speech. */
  ttsLocale: string;
  rtl?: boolean;
}

export const LANGUAGES: LanguageSpec[] = [
  { code: "en", native: "English", english: "English", ttsLocale: "en-IN" },
  { code: "hi", native: "हिन्दी", english: "Hindi", ttsLocale: "hi-IN" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi", ttsLocale: "pa-IN" },
  { code: "ur", native: "اردو", english: "Urdu", ttsLocale: "ur-IN", rtl: true },
  { code: "bn", native: "বাংলা", english: "Bengali", ttsLocale: "bn-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", ttsLocale: "mr-IN" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati", ttsLocale: "gu-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", ttsLocale: "ta-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", ttsLocale: "te-IN" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", ttsLocale: "kn-IN" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", ttsLocale: "ml-IN" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", ttsLocale: "or-IN" },
];

export function languageFor(code: string): LanguageSpec {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/** Which languages an episode's corridor actually needs. */
export const CORRIDOR_LANGUAGES: Record<string, string[]> = {
  "punjab-delhi": ["en", "hi", "pa", "ur"],
  "chiangmai-bangkok": ["en"],
};

export type SeverityBand = "advisory" | "warning" | "emergency";

export interface PublicMessage {
  /** One line, spoken first. */
  headline: string;
  /** Protective instructions, in the order they matter. */
  instructions: string[];
}

/*
   Reviewed public-health phrasebook.

   Wording follows CPCB's GRAP public advisories and WHO interim PM2.5 guidance
   so that nothing here contradicts what a state already tells its citizens.
*/
export const PHRASEBOOK: Record<SeverityBand, Record<string, PublicMessage>> = {
  emergency: {
    en: {
      headline: "Air quality is at a severe level in your area tonight.",
      instructions: [
        "Stay indoors. Keep windows and doors shut until tomorrow morning.",
        "Do not exercise, walk or work outdoors.",
        "Children, older people, pregnant women and anyone with asthma or heart disease must not go outside.",
        "If you must go out, wear an N95 mask. A cloth mask does not stop this.",
        "Go to a hospital if you have chest tightness, or breathlessness that does not settle with rest.",
      ],
    },
    hi: {
      headline: "आज रात आपके क्षेत्र में वायु गुणवत्ता गंभीर स्तर पर है।",
      instructions: [
        "घर के अंदर रहें। कल सुबह तक खिड़कियाँ और दरवाज़े बंद रखें।",
        "बाहर व्यायाम, सैर या काम न करें।",
        "बच्चे, बुज़ुर्ग, गर्भवती महिलाएँ और दमा या हृदय रोग से पीड़ित लोग बाहर बिल्कुल न निकलें।",
        "यदि बाहर जाना ज़रूरी हो तो N95 मास्क पहनें। कपड़े का मास्क इससे नहीं बचाता।",
        "सीने में जकड़न हो या आराम करने पर भी साँस न सँभले तो तुरंत अस्पताल जाएँ।",
      ],
    },
    pa: {
      headline: "ਅੱਜ ਰਾਤ ਤੁਹਾਡੇ ਇਲਾਕੇ ਵਿੱਚ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਗੰਭੀਰ ਪੱਧਰ ਉੱਤੇ ਹੈ।",
      instructions: [
        "ਘਰ ਦੇ ਅੰਦਰ ਰਹੋ। ਕੱਲ੍ਹ ਸਵੇਰ ਤੱਕ ਬਾਰੀਆਂ ਅਤੇ ਦਰਵਾਜ਼ੇ ਬੰਦ ਰੱਖੋ।",
        "ਬਾਹਰ ਕਸਰਤ, ਸੈਰ ਜਾਂ ਕੰਮ ਨਾ ਕਰੋ।",
        "ਬੱਚੇ, ਬਜ਼ੁਰਗ, ਗਰਭਵਤੀ ਔਰਤਾਂ ਅਤੇ ਦਮੇ ਜਾਂ ਦਿਲ ਦੇ ਰੋਗੀ ਬਾਹਰ ਬਿਲਕੁਲ ਨਾ ਜਾਣ।",
        "ਜੇ ਬਾਹਰ ਜਾਣਾ ਜ਼ਰੂਰੀ ਹੋਵੇ ਤਾਂ N95 ਮਾਸਕ ਪਾਓ। ਕੱਪੜੇ ਦਾ ਮਾਸਕ ਇਸ ਤੋਂ ਨਹੀਂ ਬਚਾਉਂਦਾ।",
        "ਛਾਤੀ ਵਿੱਚ ਜਕੜਨ ਹੋਵੇ ਜਾਂ ਆਰਾਮ ਕਰਨ ਉੱਤੇ ਵੀ ਸਾਹ ਨਾ ਸੰਭਲੇ ਤਾਂ ਤੁਰੰਤ ਹਸਪਤਾਲ ਜਾਓ।",
      ],
    },
    ur: {
      headline: "آج رات آپ کے علاقے میں ہوا کا معیار شدید سطح پر ہے۔",
      instructions: [
        "گھر کے اندر رہیں۔ کل صبح تک کھڑکیاں اور دروازے بند رکھیں۔",
        "باہر ورزش، سیر یا کام نہ کریں۔",
        "بچے، بزرگ، حاملہ خواتین اور دمہ یا دل کے مریض ہرگز باہر نہ نکلیں۔",
        "اگر باہر جانا ضروری ہو تو N95 ماسک پہنیں۔ کپڑے کا ماسک اس سے نہیں بچاتا۔",
        "سینے میں جکڑن ہو یا آرام کرنے پر بھی سانس نہ سنبھلے تو فوراً ہسپتال جائیں۔",
      ],
    },
  },
  warning: {
    en: {
      headline: "Air quality is poor in your area and is expected to worsen.",
      instructions: [
        "Limit time outdoors, especially between 10pm and 8am.",
        "Move exercise indoors.",
        "Children and people with asthma or heart disease should stay in.",
        "Wear an N95 mask if you are outdoors for long.",
      ],
    },
    hi: {
      headline: "आपके क्षेत्र में वायु गुणवत्ता खराब है और और बिगड़ने की आशंका है।",
      instructions: [
        "बाहर बिताया समय कम करें, ख़ासकर रात 10 बजे से सुबह 8 बजे के बीच।",
        "व्यायाम घर के अंदर करें।",
        "बच्चे और दमा या हृदय रोग से पीड़ित लोग घर के अंदर रहें।",
        "लंबे समय तक बाहर रहना हो तो N95 मास्क पहनें।",
      ],
    },
    pa: {
      headline: "ਤੁਹਾਡੇ ਇਲਾਕੇ ਵਿੱਚ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਖ਼ਰਾਬ ਹੈ ਅਤੇ ਹੋਰ ਵਿਗੜਨ ਦੀ ਸੰਭਾਵਨਾ ਹੈ।",
      instructions: [
        "ਬਾਹਰ ਬਿਤਾਇਆ ਸਮਾਂ ਘਟਾਓ, ਖ਼ਾਸਕਰ ਰਾਤ 10 ਵਜੇ ਤੋਂ ਸਵੇਰ 8 ਵਜੇ ਤੱਕ।",
        "ਕਸਰਤ ਘਰ ਦੇ ਅੰਦਰ ਕਰੋ।",
        "ਬੱਚੇ ਅਤੇ ਦਮੇ ਜਾਂ ਦਿਲ ਦੇ ਰੋਗੀ ਘਰ ਦੇ ਅੰਦਰ ਰਹਿਣ।",
        "ਲੰਮਾ ਸਮਾਂ ਬਾਹਰ ਰਹਿਣਾ ਹੋਵੇ ਤਾਂ N95 ਮਾਸਕ ਪਾਓ।",
      ],
    },
    ur: {
      headline: "آپ کے علاقے میں ہوا کا معیار خراب ہے اور مزید بگڑنے کا امکان ہے۔",
      instructions: [
        "باہر گزارا وقت کم کریں، خاص طور پر رات 10 بجے سے صبح 8 بجے تک۔",
        "ورزش گھر کے اندر کریں۔",
        "بچے اور دمہ یا دل کے مریض گھر کے اندر رہیں۔",
        "زیادہ دیر باہر رہنا ہو تو N95 ماسک پہنیں۔",
      ],
    },
  },
  advisory: {
    en: {
      headline: "Air quality is moderate in your area.",
      instructions: [
        "Anyone unusually sensitive should reduce prolonged outdoor exertion.",
        "Everyone else can continue normal activity.",
      ],
    },
    hi: {
      headline: "आपके क्षेत्र में वायु गुणवत्ता मध्यम है।",
      instructions: [
        "जो लोग विशेष रूप से संवेदनशील हैं वे बाहर लंबे समय तक अधिक परिश्रम कम करें।",
        "बाकी सभी लोग सामान्य गतिविधि जारी रख सकते हैं।",
      ],
    },
    pa: {
      headline: "ਤੁਹਾਡੇ ਇਲਾਕੇ ਵਿੱਚ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਦਰਮਿਆਨੀ ਹੈ।",
      instructions: [
        "ਜੋ ਲੋਕ ਖ਼ਾਸ ਤੌਰ ਉੱਤੇ ਸੰਵੇਦਨਸ਼ੀਲ ਹਨ, ਉਹ ਬਾਹਰ ਲੰਮੇ ਸਮੇਂ ਦੀ ਸਖ਼ਤ ਮਿਹਨਤ ਘਟਾਉਣ।",
        "ਬਾਕੀ ਸਾਰੇ ਆਮ ਗਤੀਵਿਧੀ ਜਾਰੀ ਰੱਖ ਸਕਦੇ ਹਨ।",
      ],
    },
    ur: {
      headline: "آپ کے علاقے میں ہوا کا معیار درمیانہ ہے۔",
      instructions: [
        "جو لوگ خاص طور پر حساس ہیں وہ باہر طویل محنت کم کریں۔",
        "باقی سب معمول کی سرگرمی جاری رکھ سکتے ہیں۔",
      ],
    },
  },
};

/** The reviewed message, falling back to English when a language is not yet reviewed. */
export function publicMessage(
  severity: SeverityBand,
  lang: string
): { message: PublicMessage; reviewed: boolean } {
  const band = PHRASEBOOK[severity];
  const exact = band[lang];
  if (exact) return { message: exact, reviewed: true };
  return { message: band.en, reviewed: false };
}
