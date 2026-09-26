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
  user_not_found: {
    en: "User not found.",
    hi: "उपयोगकर्ता नहीं मिला।",
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
