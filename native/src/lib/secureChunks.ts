/** Keep each SecureStore value below 2 KiB, including non-ASCII profile metadata. */
export function splitSecureValue(value: string): string[] {
  const characters = Array.from(value);
  const parts: string[] = [];
  for (let at = 0; at < characters.length; at += 500)
    parts.push(characters.slice(at, at + 500).join(""));
  if (parts.length > 128)
    throw new Error("The authentication session is too large for secure storage.");
  return parts.length ? parts : [""];
}
