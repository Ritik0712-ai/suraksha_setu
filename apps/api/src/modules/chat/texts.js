// Fixed Sahayak texts the API writes itself (no LLM call): session openers and the emergency
// card (docs/03 S-24, S-25). Wording follows docs/04 §10 — simple spoken Hindi.

export const LETTER_TITLES = {
  panchayat_complaint: { hi: "पंचायत को पत्र", en: "Letter to the Panchayat" },
  bdo_application: { hi: "BDO को आवेदन", en: "Application to the BDO" },
  certificate_application: { hi: "प्रमाण पत्र के लिए आवेदन", en: "Application for a certificate" },
  general_application: { hi: "सामान्य आवेदन", en: "General application" },
};

export const NEW_CHAT_TITLE = { hi: "नई बातचीत", en: "New chat" };

export const LETTER_OPENER = {
  hi: "ठीक है, मैं पत्र लिखने में मदद करूँगा। सबसे पहले, आवेदक का पूरा नाम बताइए।",
  en: "Sure, I'll help you write this letter. First, what is the applicant's full name?",
};

export const SCHEME_OPENER = {
  hi: (name) => `${name} के बारे में पूछिए — जैसे कौन आवेदन कर सकता है या कौन-से दस्तावेज़ चाहिए।`,
  en: (name) => `Ask me about ${name} — for example, who can apply or which documents you need.`,
};

export const SCHEME_CHIPS = {
  hi: ["कौन आवेदन कर सकता है?", "कौन-से दस्तावेज़ चाहिए?", "आवेदन कैसे करें?"],
  en: ["Who can apply?", "Which documents are needed?", "How do I apply?"],
};

export const EMERGENCY_NOTICE = {
  hi: "क्या आप खतरे में हैं? अभी SOS दबाएँ या 112 पर कॉल करें।",
  en: "Are you in danger? Press SOS or call 112 now.",
};
