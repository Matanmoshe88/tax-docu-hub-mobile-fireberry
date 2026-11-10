// Fireberry choice fields can arrive as a number or its string API value.
export const isLegalCollection = (value: unknown): boolean =>
  value === 2 || value === '2';