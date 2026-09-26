/** "Expires in 7 days", "Expires today" or "Expired 2 days ago" for an invitation's expiry time. */
export function inviteExpiryLabel(expiresAt: string, now: number = Date.now()): { text: string; expired: boolean } {
  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return { text: "No expiry date", expired: false };
  const days = Math.ceil((time - now) / 86_400_000);
  if (time <= now) {
    const ago = Math.max(1, Math.floor((now - time) / 86_400_000));
    return { text: ago === 1 ? "Expired yesterday" : `Expired ${ago} days ago`, expired: true };
  }
  if (days <= 1) return { text: "Expires today", expired: false };
  return { text: `Expires in ${days} days`, expired: false };
}
