export function formatEATTimestamp(date: Date): string {
  const eatDate = new Date(date.getTime() + 3 * 60 * 60 * 1000); // Add 3 hours for EAT
  return eatDate
    .toISOString()
    .replace("T", " ")
    .replace("Z", "")
    .substring(0, 23); // Get only up to microseconds
}
