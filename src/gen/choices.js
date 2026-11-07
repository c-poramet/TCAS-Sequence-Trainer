/**
 * Multiple-choice answer options, deterministic from the question ID.
 * Standalone: needs only the question object.
 * @module gen/choices
 */
import { createRng } from '../core/rng.js';

/** Largest neighbour distance (answer ± k) treated as a "near" distractor. */
const NEAR_MAX = 3;
/** Neighbours up to this distance get the higher "near" weight. */
const NEAR_STRONG_MAX = 2;
const WEIGHT_STRUCTURED = 3;
const WEIGHT_NEAR = 2;
const WEIGHT_FAR = 1;

/**
 * Weighted set of plausible wrong answers (value -> weight), excluding the answer
 * and every visible term.
 * @param {{terms:number[], missing:number, answer:number}} question
 * @returns {Map<number, number>}
 */
function candidateWeights(question) {
  const { terms, missing, answer } = question;
  const m = missing - 1;
  const shown = new Set(terms.filter((_, k) => k !== m));
  /** @type {Map<number, number>} */
  const out = new Map();
  /** @param {number} value @param {number} weight */
  const add = (value, weight) => {
    if (!Number.isSafeInteger(value)) return;
    const v = value + 0;
    if (v === answer || shown.has(v)) return;
    out.set(v, Math.max(out.get(v) || 0, weight));
  };

  for (let k = 1; k <= NEAR_MAX; k++) {
    const w = k <= NEAR_STRONG_MAX ? WEIGHT_NEAR : WEIGHT_FAR;
    add(answer + k, w);
    add(answer - k, w);
  }

  const prev = terms[m - 1];
  const prev2 = terms[m - 2];
  const next = terms[m + 1];
  const next2 = terms[m + 2];
  const has = (x) => x !== undefined;

  // wrong difference: keep stepping with the neighbouring gap, or take the midpoint
  if (has(prev) && has(prev2)) add(prev + (prev - prev2), WEIGHT_STRUCTURED);
  if (has(next) && has(next2)) add(next - (next2 - next), WEIGHT_STRUCTURED);
  if (has(prev) && has(next) && (prev + next) % 2 === 0) add((prev + next) / 2, WEIGHT_STRUCTURED);

  // wrong ratio
  if (has(prev) && has(prev2) && prev2 !== 0 && prev % prev2 === 0) {
    add(prev * (prev / prev2), WEIGHT_STRUCTURED);
  }
  if (has(next) && has(next2) && next !== 0 && next2 % next === 0) {
    const r = next2 / next;
    if (r !== 0 && next % r === 0) add(next / r, WEIGHT_STRUCTURED);
  }

  // off-by-one-position reading: one local step too far / too short
  const step = has(prev) ? answer - prev : has(next) ? next - answer : 0;
  if (step !== 0) {
    add(answer + step, WEIGHT_STRUCTURED);
    add(answer - step, WEIGHT_STRUCTURED);
  }

  // sign error
  if (answer !== 0) add(-answer, WEIGHT_STRUCTURED);

  return out;
}

/**
 * Pick one option by weight and remove it from the list.
 * @param {import('../core/rng.js').Rng} rng
 * @param {{value:number, weight:number}[]} items mutated
 * @returns {number} chosen value
 */
function drawWeighted(rng, items) {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let x = rng.next() * total;
  let idx = items.length - 1;
  for (let k = 0; k < items.length; k++) {
    x -= items[k].weight;
    if (x < 0) {
      idx = k;
      break;
    }
  }
  return items.splice(idx, 1)[0].value;
}

/**
 * Build `count` unique answer options containing exactly one correct answer.
 * @param {{id:string, terms:number[], missing:number, answer:number}} question
 * @param {number} count number of options (>= 1)
 * @returns {{choices:number[], correctIndex:number}}
 * @throws {RangeError} when count is not a positive integer
 */
export function getChoices(question, count) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError('count must be a positive integer');
  }
  const rng = createRng(`${question.id}/mc`);
  const { answer, terms, missing } = question;
  const shown = new Set(terms.filter((_, k) => k !== missing - 1));
  const items = [...candidateWeights(question)].map(([value, weight]) => ({ value, weight }));
  const used = new Set([answer]);
  /** @type {number[]} */
  const distractors = [];

  while (distractors.length < count - 1 && items.length > 0) {
    const v = drawWeighted(rng, items);
    distractors.push(v);
    used.add(v);
  }
  // Not enough plausible candidates: widen the neighbourhood (never a shown term)
  for (let k = NEAR_MAX + 1; distractors.length < count - 1; k++) {
    for (const v of [answer + k, answer - k]) {
      if (distractors.length >= count - 1) break;
      if (!used.has(v) && !shown.has(v)) {
        distractors.push(v);
        used.add(v);
      }
    }
  }

  const correctIndex = rng.int(0, count - 1);
  const choices = [...distractors.slice(0, correctIndex), answer, ...distractors.slice(correctIndex)];
  return { choices, correctIndex };
}
