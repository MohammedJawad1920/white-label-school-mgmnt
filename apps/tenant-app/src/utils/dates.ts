import { format, parseISO, isValid } from "date-fns";

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}
export function formatDisplayDate(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "EEE, d MMM yyyy") : iso;
}
export function formatDisplayDateTime(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "d MMM yyyy, h:mm a") : iso;
}
export function todayDayOfWeek(): string {
  return format(new Date(), "EEEE");
}
export function formatMonth(yyyyMM: string): string {
  const d = parseISO(`${yyyyMM}-01`);
  return isValid(d) ? format(d, "MMM yyyy") : yyyyMM;
}
