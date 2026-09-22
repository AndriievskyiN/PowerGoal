/** Date helpers. Dates are ISO yyyy-mm-dd strings, calendar days, no time zones. */

export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function shortDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function dayLabel(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function isIsoDate(s: string) {
  return /^(19|20)\d{2}-\d{2}-\d{2}$/.test(s);
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string) {
  const dow = new Date(iso + "T00:00:00Z").getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}
