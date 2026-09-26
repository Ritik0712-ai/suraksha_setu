/** Chip status for an SOS status from the API (docs/05 §4 sosStatus). */
export const sosChipStatus = (status) =>
  ({
    ACTIVE: "SOS_ACTIVE",
    ACKNOWLEDGED: "SOS_ACKNOWLEDGED",
    RESOLVED_SAFE: "SOS_RESOLVED",
    RESOLVED_BY_AUTHORITY: "SOS_CLOSED_BY_AUTHORITY",
    FALSE_ALARM: "SOS_FALSE_ALARM",
    AUTO_CLOSED: "SOS_AUTO_CLOSED",
  })[status] ?? "SOS_RESOLVED";
