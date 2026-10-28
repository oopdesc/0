import { CONCEPTS } from '../academy/content/concepts';
import corrections from './concept-corrections.json';

/** Reviewed display corrections shared by the recovered map and archived lessons.
 * Original files remain in the local snapshot; unrelated nodes keep their IDs. */
export const REVIEWED_CONCEPT_IDS = Object.freeze(Object.keys(corrections));
export function applyLegacyConceptCorrections(): void {
  for (const concept of CONCEPTS) {
    const correction = (corrections as Record<string,{rule:string;summary:string;contrast?:string}>)[concept.id];
    if (correction) Object.assign(concept, correction);
  }
}
// Retain the existing entry point so saved routes and callers keep working.
export const applyLegacyJavaConceptCorrections = applyLegacyConceptCorrections;
