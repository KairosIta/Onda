/**
 * I controlli di forma che schemi, adapter e policy ripetevano ognuno per
 * conto suo. Puri e minuscoli: un dato di terzi o riletto da disco si
 * guarda campo per campo, e la domanda e' sempre una di queste tre.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

/** La stringa se c'e' e non e' vuota, altrimenti niente. */
export const optionalString = (value: unknown): string | undefined =>
  nonEmptyString(value) ? value : undefined;
