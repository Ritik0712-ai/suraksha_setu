// Alert wording for SMS (sent from the user's own phone) and emails, in the user's language.

const mapsLink = (p) => `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

export function sosSmsBody({ name, trackUrl, point, approximate, lang }) {
  if (lang === "en") {
    return `${name} needs help! Live location: ${trackUrl} | Map: ${mapsLink(point)}${
      approximate ? " (approximate)" : ""
    } — Suraksha Setu`;
  }
  return `${name} को मदद चाहिए! लाइव लोकेशन: ${trackUrl} | मैप: ${mapsLink(point)}${
    approximate ? " (अनुमानित)" : ""
  } — सुरक्षा सेतु`;
}

export function sosEmail({ name, trackUrl, point, approximate, lang, at }) {
  const time = at.toLocaleString(lang === "en" ? "en-IN" : "hi-IN", { timeZone: "Asia/Kolkata" });
  if (lang === "en") {
    return {
      subject: `SOS: ${name} needs help`,
      text: [
        `${name} pressed SOS on Suraksha Setu at ${time} (IST) and added you as an emergency contact.`,
        "",
        `Live location (updates while the SOS is on): ${trackUrl}`,
        `Map${approximate ? " (approximate)" : ""}: ${mapsLink(point)}`,
        "",
        "Call them now. If you can't reach them, call 112.",
        "",
        "Suraksha Setu is an independent student project, not a government service.",
      ].join("\n"),
    };
  }
  return {
    subject: `SOS: ${name} को मदद चाहिए`,
    text: [
      `${name} ने ${time} (IST) पर सुरक्षा सेतु में SOS दबाया है। उन्होंने आपको आपातकालीन संपर्क के रूप में जोड़ा है।`,
      "",
      `लाइव लोकेशन (SOS चालू रहने तक अपडेट होती है): ${trackUrl}`,
      `मैप${approximate ? " (अनुमानित)" : ""}: ${mapsLink(point)}`,
      "",
      "अभी उन्हें कॉल करें। बात न हो पाए तो 112 पर कॉल करें।",
      "",
      "सुरक्षा सेतु एक स्वतंत्र छात्र प्रोजेक्ट है, सरकारी सेवा नहीं।",
    ].join("\n"),
  };
}

export function safeEmail({ name, lang }) {
  return lang === "en"
    ? {
        subject: `${name} is safe now`,
        text: `${name} has marked themselves safe on Suraksha Setu. The live location link has stopped.\n\nSuraksha Setu — independent student project, not a government service.`,
      }
    : {
        subject: `${name} अब सुरक्षित हैं`,
        text: `${name} ने सुरक्षा सेतु में बताया है कि वे सुरक्षित हैं। लाइव लोकेशन लिंक बंद हो गया है।\n\nसुरक्षा सेतु — स्वतंत्र छात्र प्रोजेक्ट, सरकारी सेवा नहीं।`,
      };
}
