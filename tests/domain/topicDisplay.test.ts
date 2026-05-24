import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefinitionButtonLabel } from '../../src/domain/topicDisplay';

test('definition button label reflects loading and visibility state', () => {
  assert.equal(getDefinitionButtonLabel({
    isLoading: true,
    isDefinitionVisible: false,
  }), 'Loading...');

  assert.equal(getDefinitionButtonLabel({
    isLoading: false,
    isDefinitionVisible: true,
  }), 'Hide Definition');

  assert.equal(getDefinitionButtonLabel({
    isLoading: false,
    isDefinitionVisible: false,
  }), 'Definition');

  assert.equal(getDefinitionButtonLabel({
    isLoading: false,
    isDefinitionVisible: false,
    hiddenLabel: 'Selected Source Definition',
  }), 'Selected Source Definition');
});
