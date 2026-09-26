// Optional status emails to citizens who added an email address (doc 06 task 4E.3).

const STATUS = {
  SUBMITTED: { hi: "दर्ज", en: "Submitted" },
  VERIFIED: { hi: "जाँची गई", en: "Verified" },
  ASSIGNED: { hi: "विभाग को सौंपी गई", en: "Assigned" },
  IN_PROGRESS: { hi: "काम चल रहा है", en: "In progress" },
  RESOLVED: { hi: "हल हो गई", en: "Resolved" },
  REJECTED: { hi: "अस्वीकार", en: "Rejected" },
};

export function complaintEmail({ complaint: c, kind, lang = "hi" }) {
  const l = lang === "en" ? "en" : "hi";
  const status = STATUS[c.status]?.[l] ?? c.status;
  if (l === "en")
    return {
      subject: `Complaint ${c.complaintNo}: ${kind === "complaint_note" ? "new update" : status}`,
      text: [
        `Your complaint ${c.complaintNo} has an update.`,
        `Status: ${status}`,
        "Open the Suraksha Setu app to see the details.",
        "",
        "Suraksha Setu — an independent student project of VIT Bhopal. Not a government service.",
      ].join("\n"),
    };
  return {
    subject: `शिकायत ${c.complaintNo}: ${kind === "complaint_note" ? "नई जानकारी" : status}`,
    text: [
      `आपकी शिकायत ${c.complaintNo} में नई जानकारी है।`,
      `स्थिति: ${status}`,
      "पूरी जानकारी के लिए सुरक्षा सेतु ऐप खोलें।",
      "",
      "सुरक्षा सेतु — VIT भोपाल का स्वतंत्र छात्र प्रोजेक्ट। यह सरकारी सेवा नहीं है।",
    ].join("\n"),
  };
}
