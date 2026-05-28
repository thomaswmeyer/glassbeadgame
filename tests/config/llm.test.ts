import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LLM_MODEL_DEFINITIONS,
  getDefaultJudgeModelKey,
  normalizeModelKey,
  resolveModelConfig,
  resolveModelProviderInfo,
} from '../../src/config/llm';

const ENV_KEYS = [
  'GBG_DEFAULT_AI_MODEL_KEY',
  'GBG_JUDGE_MODEL_KEY',
  'GBG_TOPIC_MODEL_KEY',
  'GBG_DEFINITION_MODEL_KEY',
  'NEXT_PUBLIC_GBG_DEFAULT_AI_MODEL_KEY',
  'GEMINI_MODEL',
  'GEMINI_FLASH_MODEL',
  'GEMINI_PRO_MODEL',
  'OPENAI_MODEL',
  'OPENAI_FRONTIER_MODEL',
  'OPENAI_FAST_MODEL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_OPUS_MODEL',
  'ANTHROPIC_SONNET_MODEL',
] as const;

function withCleanEnv(callback: () => void) {
  const previousValues = Object.fromEntries(
    ENV_KEYS.map(key => [key, process.env[key]])
  );

  ENV_KEYS.forEach(key => {
    delete process.env[key];
  });

  try {
    callback();
  } finally {
    ENV_KEYS.forEach(key => {
      const previousValue = previousValues[key];
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    });
  }
}

test('model registry includes Gemini, OpenAI, and Anthropic providers', () => {
  assert.equal(LLM_MODEL_DEFINITIONS.gemini_flash.providerId, 'gemini');
  assert.equal(LLM_MODEL_DEFINITIONS.gemini_pro.providerId, 'gemini');
  assert.equal(LLM_MODEL_DEFINITIONS.openai_frontier.providerId, 'openai');
  assert.equal(LLM_MODEL_DEFINITIONS.claude_sonnet.providerId, 'anthropic');
});

test('model resolution defaults to Gemini flash and normalizes unknown keys', () => {
  withCleanEnv(() => {
    assert.equal(normalizeModelKey(undefined), 'gemini_flash');
    assert.equal(normalizeModelKey('unknown'), 'gemini_flash');

    const config = resolveModelConfig('response');
    assert.equal(config.key, 'gemini_flash');
    assert.equal(config.providerId, 'gemini');
    assert.equal(config.model, 'gemini-2.5-flash-lite');
  });
});

test('task model resolution supports independent AI and judge model keys', () => {
  withCleanEnv(() => {
    process.env.GBG_DEFAULT_AI_MODEL_KEY = 'openai_frontier';
    process.env.GBG_JUDGE_MODEL_KEY = 'claude_sonnet';
    process.env.OPENAI_FRONTIER_MODEL = 'gpt-custom';
    process.env.ANTHROPIC_SONNET_MODEL = 'claude-custom';

    const responseConfig = resolveModelConfig('response');
    const judgeConfig = resolveModelConfig('evaluation');

    assert.equal(responseConfig.providerId, 'openai');
    assert.equal(responseConfig.model, 'gpt-custom');
    assert.equal(getDefaultJudgeModelKey(), 'claude_sonnet');
    assert.equal(judgeConfig.providerId, 'anthropic');
    assert.equal(judgeConfig.model, 'claude-custom');
  });
});

test('explicit model keys override task defaults', () => {
  withCleanEnv(() => {
    process.env.GBG_JUDGE_MODEL_KEY = 'claude_sonnet';

    const config = resolveModelConfig('evaluation', 'gemini_pro');
    assert.equal(config.key, 'gemini_pro');
    assert.equal(config.providerId, 'gemini');
    assert.equal(config.model, 'gemini-2.5-pro');
  });
});

test('provider info resolves persisted model metadata from a player model key', () => {
  withCleanEnv(() => {
    process.env.ANTHROPIC_OPUS_MODEL = 'claude-opus-custom';

    assert.deepEqual(resolveModelProviderInfo('claude_opus'), {
      provider: 'anthropic',
      modelId: 'claude-opus-custom',
      modelKey: 'claude_opus',
      displayName: 'Claude Opus',
    });

    assert.deepEqual(resolveModelProviderInfo('openclaw'), {
      provider: 'unknown',
      modelId: 'openclaw',
      modelKey: 'openclaw',
      displayName: 'openclaw',
    });
  });
});

test('provider generation policies are exposed through provider adapters', () => {
  withCleanEnv(() => {
    const geminiConfig = resolveModelConfig('evaluation', 'gemini_pro');
    const openAiConfig = resolveModelConfig('evaluation', 'openai_frontier');

    assert.equal(
      geminiConfig.provider.resolveMaxOutputTokens(geminiConfig.model, 'topic', 100),
      4096
    );
    assert.equal(
      geminiConfig.provider.resolveMaxOutputTokens(geminiConfig.model, 'evaluation', 1000),
      4096
    );
    assert.equal(geminiConfig.provider.resolveGenerationOptions?.(geminiConfig.model, 'topic'), undefined);
    assert.deepEqual(geminiConfig.provider.resolveGenerationOptions?.(geminiConfig.model, 'evaluation'), {
      thinkingConfig: { thinkingBudget: 1024 },
    });
    assert.deepEqual(geminiConfig.provider.resolveGenerationOptions?.(geminiConfig.model, 'response'), {
      thinkingConfig: { thinkingBudget: 512 },
    });
    assert.equal(
      openAiConfig.provider.resolveMaxOutputTokens(openAiConfig.model, 'evaluation', 1000),
      1000
    );
    assert.equal(openAiConfig.provider.resolveGenerationOptions?.(openAiConfig.model, 'topic'), undefined);
  });
});
