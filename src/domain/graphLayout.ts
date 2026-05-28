import { GraphRenderEdge, GraphRenderNode } from './game';
import { getSubjectCategoryColor } from './subjectCategories';

export const GRAPH_NODE_RADIUS = 12;

export type GraphPosition = {
  x: number;
  y: number;
};

export type GraphLayoutNode = GraphRenderNode & {
  color: string;
  beadColor: string;
  beadScore: number;
  radius: number;
  x: number;
  y: number;
};

export type GraphLayoutEdge = {
  id: string;
  source: string;
  target: string;
  color: string;
  semanticDistanceScore?: number;
  strengthScore?: number;
  totalScore?: number;
  scoringDescription?: string;
  semanticDistanceDescription?: string;
  strengthDescription?: string;
};

export type GraphLayoutData = {
  nodes: GraphLayoutNode[];
  edges: GraphLayoutEdge[];
};

export type GraphViewportTransform = {
  translateX: number;
  translateY: number;
  scale: number;
};

export function getGraphNodeColor(node: GraphRenderNode) {
  return getSubjectCategoryColor(node.subjectCategory);
}

export function getGraphTurnOrderColor(turnIndex: number | undefined) {
  const colors = [
    '#2563EB',
    '#DC2626',
    '#16A34A',
    '#D97706',
    '#7C3AED',
    '#0891B2',
  ];

  return typeof turnIndex === 'number' && turnIndex >= 0
    ? colors[turnIndex % colors.length]
    : '#64748B';
}

export function getGraphEdgeColor(edge: Pick<GraphRenderEdge, 'playerTurnIndex'>) {
  return getGraphTurnOrderColor(edge.playerTurnIndex);
}

function clampScore(score: number) {
  return Math.max(1, Math.min(10, score));
}

export function getGraphEdgeDistance(edge: Pick<GraphLayoutEdge, 'semanticDistanceScore'>) {
  const semanticDistance = clampScore(edge.semanticDistanceScore ?? 5);
  return semanticDistance * 24;
}

export function getGraphEdgeStrokeWidth(edge: Pick<GraphLayoutEdge, 'strengthScore'>) {
  const relevance = clampScore(edge.strengthScore ?? 5);
  return 1 + relevance * 1.2;
}

export function getGraphNodeBeadScore(
  node: Pick<GraphRenderNode, 'id' | 'isRoot'>,
  edges: Array<Pick<GraphRenderEdge, 'sourceNodeId' | 'destinationNodeId' | 'totalScore'>>
) {
  const incidentScores = edges
    .filter(edge => edge.sourceNodeId === node.id || edge.destinationNodeId === node.id)
    .map(edge => Math.max(0, edge.totalScore ?? 0));

  if (incidentScores.length === 0) return node.isRoot ? 81 : 0;

  const scoreSum = incidentScores.reduce((sum, score) => sum + score, 0);
  return scoreSum / Math.sqrt(incidentScores.length);
}

export function getGraphNodeBeadRadius(node: Pick<GraphLayoutNode, 'beadScore'>) {
  const score = Math.max(0, Math.min(150, node.beadScore));
  return 0.14 + Math.sqrt(score / 100) * 0.16;
}

export function createGraphLayoutData(params: {
  nodes: GraphRenderNode[];
  edges: GraphRenderEdge[];
  previousPositions: Map<string, GraphPosition>;
  width: number;
  height: number;
}): GraphLayoutData {
  const rootNode = params.nodes.find(node => node.isRoot);
  const rootPosition = params.previousPositions.get(rootNode?.id || '') || {
    x: params.width / 2,
    y: params.height / 2,
  };
  const nodeIds = new Set(params.nodes.map(node => node.id));
  const validRenderEdges = params.edges.filter(
    edge => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.destinationNodeId)
  );

  const nodes = params.nodes.map((node, index) => {
    const previousPosition = params.previousPositions.get(node.id);
    const incomingEdge = validRenderEdges.find(edge => edge.destinationNodeId === node.id);
    const parentPosition = incomingEdge
      ? params.previousPositions.get(incomingEdge.sourceNodeId) || rootPosition
      : rootPosition;
    const angle = index * 0.9;
    const seededPosition = previousPosition || (node.isRoot
      ? rootPosition
      : {
          x: parentPosition.x + Math.cos(angle) * 72,
          y: parentPosition.y + Math.sin(angle) * 72,
        });

    return {
      ...node,
      color: getGraphNodeColor(node),
      beadColor: getGraphNodeColor(node),
      beadScore: getGraphNodeBeadScore(node, validRenderEdges),
      radius: GRAPH_NODE_RADIUS,
      x: seededPosition.x,
      y: seededPosition.y,
    };
  });

  const edges = validRenderEdges
    .map(edge => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.destinationNodeId,
      color: getGraphEdgeColor(edge),
      semanticDistanceScore: edge.semanticDistanceScore,
      strengthScore: edge.strengthScore,
      totalScore: edge.totalScore,
      scoringDescription: edge.scoringDescription,
      semanticDistanceDescription: edge.semanticDistanceDescription,
      strengthDescription: edge.strengthDescription,
    }));

  return { nodes, edges };
}

export function calculateGraphViewportTransform(params: {
  nodes: Array<Pick<GraphLayoutNode, 'x' | 'y' | 'radius'>>;
  width: number;
  height: number;
  padding?: number;
  maxScale?: number;
  labelPadding?: number;
}): GraphViewportTransform | null {
  if (params.nodes.length === 0) return null;

  const padding = params.padding ?? 48;
  const maxScale = params.maxScale ?? 1.1;
  const labelPadding = params.labelPadding ?? 42;
  const bounds = params.nodes.reduce(
    (acc, node) => {
      const radius = node.radius + labelPadding;

      return {
        minX: Math.min(acc.minX, node.x - radius),
        maxX: Math.max(acc.maxX, node.x + radius),
        minY: Math.min(acc.minY, node.y - radius),
        maxY: Math.max(acc.maxY, node.y + radius),
      };
    },
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

  const graphWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const graphHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const availableWidth = Math.max(params.width - padding * 2, 1);
  const availableHeight = Math.max(params.height - padding * 2, 1);
  const scale = Math.min(
    maxScale,
    availableWidth / graphWidth,
    availableHeight / graphHeight
  );
  const translateX = params.width / 2 - scale * ((bounds.minX + bounds.maxX) / 2);
  const translateY = params.height / 2 - scale * ((bounds.minY + bounds.maxY) / 2);

  return {
    translateX,
    translateY,
    scale,
  };
}
