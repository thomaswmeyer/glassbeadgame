import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatGeminiModelDisplayName,
  normalizeGeminiModelName,
  resolveGeminiMaxOutputTokens,
  resolveGeminiThinkingConfig,
} from '../../src/config/llm';

test('Gemini model configuration defaults to flash-lite when unset or blank', () => {
  assert.equal(normalizeGeminiModelName(undefined), 'gemini-3.1-flash-lite');
  assert.equal(normalizeGeminiModelName('   '), 'gemini-3.1-flash-lite');
});

test('Gemini model configuration preserves explicit model overrides', () => {
  assert.equal(normalizeGeminiModelName(' gemini-2.5-pro '), 'gemini-2.5-pro');
  assert.equal(formatGeminiModelDisplayName('gemini-2.5-pro'), 'Gemini 2.5 Pro');
  assert.equal(formatGeminiModelDisplayName('gemini-custom-model'), 'gemini-custom-model');
});

test('Gemini thinking models receive larger output and thinking budgets', () => {
  assert.equal(resolveGeminiMaxOutputTokens('gemini-3.1-flash-lite', 'topic', 100), 100);
  assert.equal(resolveGeminiThinkingConfig('gemini-3.1-flash-lite', 'topic'), undefined);

  assert.equal(resolveGeminiMaxOutputTokens('gemini-2.5-pro', 'topic', 100), 1024);
  assert.deepEqual(resolveGeminiThinkingConfig('gemini-2.5-pro', 'topic'), {
    thinkingBudget: 256,
  });
  assert.equal(resolveGeminiMaxOutputTokens('gemini-2.5-pro', 'evaluation', 1000), 4096);
});
