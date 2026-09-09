export function shouldEmphasizeOrangeGuidance(
  status: string,
  date = new Date(),
): boolean {
  if (!["required", "recommended", "area-dependent"].includes(status)) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const monthDay = month * 100 + day;

  return monthDay >= 815 || monthDay <= 531;
}
