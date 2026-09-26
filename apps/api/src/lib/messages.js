// User-facing API messages in both languages (docs/02 §7.1: errors come back in the request
// language). Wording follows docs/03 so the UI can show them as-is.
export const MESSAGES = {
  validation: {
    en: "Please check the highlighted fields.",
    hi: "कृपया चिह्नित जानकारी जाँचें।",
  },
  malformed_json: {
    en: "The request could not be read.",
    hi: "अनुरोध पढ़ा नहीं जा सका।",
  },
  unauthenticated: {
    en: "Please log in again.",
    hi: "कृपया फिर से लॉग इन करें।",
  },
  token_expired: {
    en: "Your session has expired. Please log in again.",
    hi: "आपका सत्र समाप्त हो गया। कृपया फिर से लॉग इन करें।",
  },
  forbidden: {
    en: "You don't have access to this.",
    hi: "आपको इसकी अनुमति नहीं है।",
  },
  not_found: {
    en: "Not found.",
    hi: "नहीं मिला।",
  },
  rate_limited: {
    en: "Please wait a few minutes and try again.",
    hi: "कृपया कुछ मिनट रुककर फिर से कोशिश करें।",
  },
  internal: {
    en: "Something went wrong on our side. Please try again.",
    hi: "हमारी तरफ़ से गड़बड़ हुई। फिर से कोशिश करें।",
  },
  invalid_credentials: {
    en: "Mobile number or password is incorrect.",
    hi: "मोबाइल नंबर या पासवर्ड गलत है।",
  },
  account_locked: {
    en: "Too many attempts. Try again after 30 minutes.",
    hi: "बहुत ज़्यादा प्रयास। 30 मिनट बाद कोशिश करें।",
  },
  account_inactive: {
    en: "This account is inactive. Contact the Suraksha Setu team.",
    hi: "यह खाता बंद है। सुरक्षा सेतु टीम से संपर्क करें।",
  },
  phone_taken: {
    en: "This number is already registered.",
    hi: "यह नंबर पहले से रजिस्टर है।",
  },
  email_taken: {
    en: "This email is already used by another account.",
    hi: "यह ईमेल किसी और खाते में इस्तेमाल हो चुका है।",
  },
  invalid_jurisdiction: {
    en: "Please choose your village from the list.",
    hi: "कृपया सूची से अपना गाँव चुनें।",
  },
  reset_invalid: {
    en: "This link/code has expired or is wrong. Ask for a new one.",
    hi: "यह लिंक/कोड समाप्त हो गया है या गलत है। नया माँगें।",
  },
  wrong_current_password: {
    en: "Your current password is incorrect.",
    hi: "आपका मौजूदा पासवर्ड गलत है।",
  },
  own_number: {
    en: "This is your own number.",
    hi: "यह आपका अपना नंबर है।",
  },
  contact_duplicate: {
    en: "Already added.",
    hi: "यह नंबर पहले से जुड़ा है।",
  },
  too_many_contacts: {
    en: "Maximum 5 contacts.",
    hi: "अधिकतम 5 संपर्क।",
  },
  contact_not_found: {
    en: "Contact not found.",
    hi: "संपर्क नहीं मिला।",
  },
  user_not_found: {
    en: "User not found.",
    hi: "उपयोगकर्ता नहीं मिला।",
  },
  complaint_not_found: {
    en: "Complaint not found.",
    hi: "शिकायत नहीं मिली।",
  },
  complaint_daily_limit: {
    en: "You've reached today's limit of 10 complaints. Try tomorrow.",
    hi: "आज की 10 शिकायतों की सीमा पूरी हो गई। कल फिर कोशिश करें।",
  },
  upload_daily_limit: {
    en: "Too many photos today. Try tomorrow, or continue without a photo.",
    hi: "आज बहुत सारी फ़ोटो भेजी जा चुकी हैं। कल कोशिश करें या बिना फ़ोटो के आगे बढ़ें।",
  },
  upload_failed: {
    en: "Couldn't upload the photo.",
    hi: "फ़ोटो अपलोड नहीं हो सकी।",
  },
  upload_invalid: {
    en: "This photo has expired or was already used. Please add it again.",
    hi: "यह फ़ोटो पुरानी हो गई है या पहले इस्तेमाल हो चुकी है। कृपया फिर से जोड़ें।",
  },
  image_required: {
    en: "Please choose a photo.",
    hi: "कृपया एक फ़ोटो चुनें।",
  },
  image_type: {
    en: "Please choose a photo (JPG, PNG or WebP).",
    hi: "कृपया फ़ोटो चुनें (JPG, PNG या WebP)।",
  },
  image_too_large: {
    en: "The photo is larger than 5 MB.",
    hi: "फ़ोटो 5 MB से बड़ी है।",
  },
  no_department: {
    en: "Complaints from this area can't be routed yet. Please call the Gram Panchayat.",
    hi: "इस क्षेत्र की शिकायतें अभी भेजी नहीं जा सकतीं। कृपया ग्राम पंचायत को फ़ोन करें।",
  },
  reopen_not_resolved: {
    en: "Only a resolved complaint can be reopened.",
    hi: "सिर्फ़ हल हुई शिकायत दोबारा खोली जा सकती है।",
  },
  reopen_expired: {
    en: "More than 7 days have passed. To report it again, create a new complaint.",
    hi: "7 दिन से ज़्यादा हो गए। दोबारा बताने के लिए नई शिकायत दर्ज करें।",
  },
  reopen_limit: {
    en: "This complaint has already been reopened twice. Please create a new complaint.",
    hi: "यह शिकायत दो बार दोबारा खोली जा चुकी है। कृपया नई शिकायत दर्ज करें।",
  },
  complaint_changed: {
    en: "This complaint was just updated. Please reload.",
    hi: "यह शिकायत अभी-अभी बदली गई है। कृपया दोबारा लोड करें।",
  },
};

/** Picks "hi" or "en" from Accept-Language. Hindi is the default (docs/01 FR-GEN-01). */
export function requestLanguage(req) {
  const header = String(req.headers["accept-language"] || "").toLowerCase();
  return header.startsWith("en") ? "en" : "hi";
}

export function translate(key, lang) {
  const m = MESSAGES[key];
  return m ? m[lang] || m.hi : undefined;
}
