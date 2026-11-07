/**
 * Thin binding of the engine to the real pool. All logic lives in engine.js.
 * @module gen/generator
 */
import * as pool from '../pool/index.js';
import { createEngine, GenerationError, RebuildError } from './engine.js';

const engine = createEngine({ pool });

export { GenerationError, RebuildError };

/** @type {typeof engine.generateQuestion} */
export const generateQuestion = engine.generateQuestion;
/** @type {typeof engine.questionFromDescriptor} */
export const questionFromDescriptor = engine.questionFromDescriptor;
/** @type {typeof engine.rebuildQuestion} */
export const rebuildQuestion = engine.rebuildQuestion;
/** @type {typeof engine.generateSetQuestion} */
export const generateSetQuestion = engine.generateSetQuestion;
/** @type {typeof engine.generateSet} */
export const generateSet = engine.generateSet;
/** @type {typeof engine.generateSetFromId} */
export const generateSetFromId = engine.generateSetFromId;
