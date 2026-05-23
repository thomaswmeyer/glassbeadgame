import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateGraphViewportTransform,
  createGraphLayoutData,
  getGraphNodeColor,
  type GraphPosition,
} from '../../src/domain/graphLayout';
import {
  type GraphRenderEdge,
  type GraphRenderNode,
} from '../../src/domain/game';

const rootNode: GraphRenderNode = {
  id: 'root',
  label: 'Cathedrals',
  topic: 'Cathedrals',
  playerId: 'player-ai',
  playerKind: 'ai',
  isRoot: true,
  isCurrent: false,
  isSelected: false,
  isActiveSource: false,
};

const childNode: GraphRenderNode = {
  id: 'node-1',
  label: 'Flying buttresses',
  topic: 'Flying buttresses',
  playerId: 'player-local',
  playerKind: 'local',
  isRoot: false,
  isCurrent: true,
  isSelected: true,
  isActiveSource: true,
};

const edge: GraphRenderEdge = {
  id: 'edge-0-0',
  sourceNodeId: 'root',
  destinationNodeId: 'node-1',
  playerId: 'player-local',
  semanticDistanceScore: 6,
  strengthScore: 7,
  scoringDescription: 'Overall rationale.',
  semanticDistanceDescription: 'Distant but coherent.',
  strengthDescription: 'Strong similarity.',
};

function assertApproximatelyEqual(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `Expected ${actual} to be approximately ${expected}`
  );
}

test('graph layout assigns visual node attributes without depending on the renderer', () => {
  assert.equal(getGraphNodeColor(rootNode), '#D97706');
  assert.equal(getGraphNodeColor({ ...childNode, playerKind: 'ai' }), '#DC2626');
  assert.equal(getGraphNodeColor(childNode), '#2563EB');

  const layout = createGraphLayoutData({
    nodes: [rootNode, childNode],
    edges: [edge],
    previousPositions: new Map(),
    width: 800,
    height: 600,
  });

  assert.deepEqual(layout.nodes.map(node => ({
    id: node.id,
    color: node.color,
    radius: node.radius,
    x: node.x,
    y: node.y,
  })), [
    { id: 'root', color: '#D97706', radius: 16, x: 400, y: 300 },
    {
      id: 'node-1',
      color: '#2563EB',
      radius: 12,
      x: 400 + Math.cos(0.9) * 72,
      y: 300 + Math.sin(0.9) * 72,
    },
  ]);
});

test('graph layout reuses previous positions for stable rerenders', () => {
  const previousPositions = new Map<string, GraphPosition>([
    ['root', { x: 120, y: 140 }],
    ['node-1', { x: 260, y: 280 }],
  ]);

  const layout = createGraphLayoutData({
    nodes: [rootNode, childNode],
    edges: [edge],
    previousPositions,
    width: 800,
    height: 600,
  });

  assert.deepEqual(
    layout.nodes.map(node => ({ id: node.id, x: node.x, y: node.y })),
    [
      { id: 'root', x: 120, y: 140 },
      { id: 'node-1', x: 260, y: 280 },
    ]
  );
});

test('graph layout filters edges with missing endpoints and preserves edge scoring metadata', () => {
  const layout = createGraphLayoutData({
    nodes: [rootNode, childNode],
    edges: [
      edge,
      {
        ...edge,
        id: 'edge-missing',
        destinationNodeId: 'missing-node',
      },
    ],
    previousPositions: new Map(),
    width: 800,
    height: 600,
  });

  assert.deepEqual(layout.edges, [{
    id: 'edge-0-0',
    source: 'root',
    target: 'node-1',
    color: '#94A3B8',
    semanticDistanceScore: 6,
    strengthScore: 7,
    scoringDescription: 'Overall rationale.',
    semanticDistanceDescription: 'Distant but coherent.',
    strengthDescription: 'Strong similarity.',
  }]);
});

test('viewport transform fits graph bounds within viewport padding', () => {
  const transform = calculateGraphViewportTransform({
    nodes: [
      { x: 100, y: 100, radius: 10 },
      { x: 300, y: 200, radius: 10 },
    ],
    width: 500,
    height: 300,
    padding: 50,
    labelPadding: 0,
    maxScale: 10,
  });

  assert.ok(transform);
  assertApproximatelyEqual(transform.translateX, -83.33333333333337);
  assertApproximatelyEqual(transform.translateY, -100);
  assertApproximatelyEqual(transform.scale, 1.6666666666666667);
});

test('viewport transform returns null for empty graphs and caps scale for compact graphs', () => {
  assert.equal(calculateGraphViewportTransform({
    nodes: [],
    width: 500,
    height: 300,
  }), null);

  assert.deepEqual(calculateGraphViewportTransform({
    nodes: [{ x: 250, y: 150, radius: 10 }],
    width: 500,
    height: 300,
    padding: 50,
    labelPadding: 0,
    maxScale: 1.1,
  }), {
    translateX: -25,
    translateY: -15,
    scale: 1.1,
  });
});
