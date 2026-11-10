// Fireberry choice fields can arrive as a number or its string API value.
export const isLegalCollection = (value: unknown): boolean =>
  value === 3 || value === '3';