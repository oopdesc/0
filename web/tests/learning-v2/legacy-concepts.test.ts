import test from 'node:test';
import assert from 'node:assert/strict';
import { CONCEPTS } from '../../src/academy/content/concepts';
import { CONCEPT_BY_ID } from '../../src/academy/lib/learn';
import { applyLegacyJavaConceptCorrections, REVIEWED_CONCEPT_IDS } from '../../src/learning-v2/legacyConceptCorrections';

test('reviewed concept corrections are scoped, idempotent and seen by prebuilt indices', () => {
  const before = structuredClone(CONCEPTS);
  const corrected = new Set(REVIEWED_CONCEPT_IDS);
  applyLegacyJavaConceptCorrections();
  const after = structuredClone(CONCEPTS);
  for (let i=0; i<before.length; i++) {
    const old = before[i], current = after[i];
    assert.equal(current.id,old.id);
    if (!corrected.has(old.id)) assert.deepEqual(current,old,`unrelated concept ${old.id} changed`);
    else {
      assert.equal(current.lang,old.lang);
      assert.notDeepEqual(current,old);
      assert.equal(CONCEPT_BY_ID.get(old.id)?.summary,current.summary,'prebuilt map sees the displayed correction');
    }
  }
  assert.match(CONCEPT_BY_ID.get('j-type')!.summary,/精度が失われる/);
  assert.match(CONCEPT_BY_ID.get('j-immutability')!.summary,/可変な要素/);
  assert.match(CONCEPT_BY_ID.get('j-record')!.summary,/参照先.*不変|可変な参照先/);
  assert.match(CONCEPT_BY_ID.get('j-compound-assignment')!.rule,/一度だけ/);
  applyLegacyJavaConceptCorrections();
  assert.deepEqual(CONCEPTS,after,'a second application changes nothing');
});
