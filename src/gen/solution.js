/**
 * Thin binding of the solution assembler to the real pool.
 * @module gen/solution
 */
import * as pool from '../pool/index.js';
import { createEngine } from './engine.js';

const engine = createEngine({ pool });

/**
 * Step-by-step solution of a question.
 * @type {(question: import('./engine.js').Question) => import('./engine.js').Solution}
 */
export const buildSolution = engine.buildSolution;
