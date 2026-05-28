import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getConfiguredGraphRendererKind,
  getNextGraphRendererKind,
  normalizeGraphRendererKind,
} from '../../src/app/components/graph/graphRendererTypes';

test('graph renderer selection defaults to SVG', () => {
  assert.equal(normalizeGraphRendererKind(undefined), 'svg');
  assert.equal(normalizeGraphRendererKind('canvas'), 'svg');
  assert.equal(normalizeGraphRendererKind('svg'), 'svg');
});

test('graph renderer selection can opt into WebGL', () => {
  assert.equal(normalizeGraphRendererKind('webgl'), 'webgl');
});

test('graph renderer selection toggles between SVG and WebGL', () => {
  assert.equal(getNextGraphRendererKind('svg'), 'webgl');
  assert.equal(getNextGraphRendererKind('webgl'), 'svg');
});

test('configured graph renderer reads the public environment setting', () => {
  const previousValue = process.env.NEXT_PUBLIC_GBG_GRAPH_RENDERER;

  try {
    process.env.NEXT_PUBLIC_GBG_GRAPH_RENDERER = 'webgl';
    assert.equal(getConfiguredGraphRendererKind(), 'webgl');

    process.env.NEXT_PUBLIC_GBG_GRAPH_RENDERER = 'unknown';
    assert.equal(getConfiguredGraphRendererKind(), 'svg');
  } finally {
    if (previousValue === undefined) {
      delete process.env.NEXT_PUBLIC_GBG_GRAPH_RENDERER;
    } else {
      process.env.NEXT_PUBLIC_GBG_GRAPH_RENDERER = previousValue;
    }
  }
});
