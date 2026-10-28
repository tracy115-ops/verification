export const text = { type: 'string', maxLength: 12000 };
export const id = { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,79}$' };
export const nonempty = { ...text, minLength: 1, pattern: '\\S' };
export const list = (items: object, maxItems = 200) => ({ type: 'array', maxItems, items });
export const record = (properties: Record<string, object>, optional: string[] = []) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties).filter((key) => !optional.includes(key)),
  properties,
});
export const factor = record({
  id,
  name: nonempty,
  levels: { ...list(nonempty, 30), minItems: 1, uniqueItems: true },
  basis: { enum: ['explicit', 'hypothesis'] },
  sourceQuote: text,
  rationale: nonempty,
});
export const factorValue = record({ factorId: id, level: nonempty });
export const review = record({
  decision: { enum: ['accepted', 'needs_changes'] },
  by: id,
  at: nonempty,
  comment: text,
});
export const oracleBasis = { enum: ['unknown', 'contract', 'approved_assumption'] };
export const scenarioFields = {
  id,
  title: nonempty,
  interfaceIds: { ...list(id, 20), uniqueItems: true },
  factorValues: list(factorValue, 30),
  oracle: text,
  oracleBasis,
  sourceQuote: text,
  ownerId: { type: 'string', maxLength: 80 },
};
