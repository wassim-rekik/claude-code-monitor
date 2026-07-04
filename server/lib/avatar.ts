// Derives a two-letter avatar initials from a user id (email or username).

export function makeAvatar(userId: string): string {
  const parts = userId.split(/[@.\s]/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}
