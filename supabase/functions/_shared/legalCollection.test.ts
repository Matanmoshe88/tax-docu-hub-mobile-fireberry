import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { isLegalCollection } from './legalCollection.ts';

describe('legal collection payment restriction', () => {
  it('blocks only API value 2, numeric or string', () => {
    assert.equal(isLegalCollection(2), true);
    assert.equal(isLegalCollection('2'), true);
  });
  it('does not label normal, missing, or malformed values as legal collection', () => {
    for (const value of [1, 3, '1', '3', undefined, null, '', 0, false, true, {}, [], 'טיפול משפטי', '02']) {
      assert.equal(isLegalCollection(value), false, `Unexpected restriction for ${JSON.stringify(value)}`);
    }
  });
});