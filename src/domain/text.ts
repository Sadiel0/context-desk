/** Keep newlines and tabs. Drop other control characters, including nulls. */
export function cleanText(input: string, max: number): string {
  const stripped = input
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return stripped.slice(0, max);
}

export function blankToNull(input: string, max: number): string | null {
  const cleaned = cleanText(input, max).trim();
  return cleaned ? cleaned : null;
}
