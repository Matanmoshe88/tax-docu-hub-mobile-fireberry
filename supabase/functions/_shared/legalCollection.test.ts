import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { isLegalCollection } from './legalCollection.ts';

describe('legal collection payment restriction', () => {
  it('blocks only API value 3, numeric or string', () => {
    assert.equal(isLegalCollection(3), true);
    assert.equal(isLegalCollection('3'), true);
  });
  it('does not label normal, missing, or malformed values as legal collection', () => {
    for (const value of [1, 2, '1', '2', undefined, null, '', 0, false, true, {}, [], 'טיפול משפטי', '03']) {
      assert.equal(isLegalCollection(value), false, `Unexpected restriction for ${JSON.stringify(value)}`);
    }
  });
});