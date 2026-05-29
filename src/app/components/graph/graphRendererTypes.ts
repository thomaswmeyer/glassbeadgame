import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type * as d3 from 'd3';
import { GraphRenderEdge, GraphRenderNode } from '@/domain/game';
import type {
  GraphLayoutEdge,
  GraphLayoutNode,
  GraphPosition,
  GraphViewportTransform,
} from '@/domain/graphLayout';

export type GraphRendererKind = 'svg' | 'webgl';

export type SimulationNode = GraphLayoutNode & d3.SimulationNodeDatum;

export type SimulationEdge =
  Omit<GraphLayoutEdge, 'source' | 'target'> &
  d3.SimulationLinkDatum<SimulationNode> & {
    source: string | SimulationNode;
    target: string | SimulationNode;
  };

export type GraphData = {
  nodes: SimulationNode[];
  edges: SimulationEdge[];
};

export type ConceptGraphRendererProps = {
  nodes: GraphRenderNode[];
  edges: GraphRenderEdge[];
  width?: number;
  height?: number;
  interactionsDisabled?: boolean;
  onNodeClick: (nodeId: string) => void;
  onAddSourceNode: (nodeId: string) => void;
  onRemoveSourceNode: (nodeId: string) => void;
};

export type SharedGraphRendererProps = ConceptGraphRendererProps & {
  graphData: GraphData;
  dimensions: {
    width: number;
    height: number;
  };
  transform: GraphViewportTransform;
  frameVersion: number;
  positionsRef: MutableRefObject<Map<string, GraphPosition>>;
  simulationRef: MutableRefObject<d3.Simulation<SimulationNode, SimulationEdge> | null>;
  fitGraphToViewport: (duration?: number) => void;
  setFrameVersion: Dispatch<SetStateAction<number>>;
};

export function normalizeGraphRendererKind(value: string | undefined): GraphRendererKind {
  return value === 'webgl' ? 'webgl' : 'svg';
}

export function getConfiguredGraphRendererKind(): GraphRendererKind {
  return normalizeGraphRendererKind(process.env.NEXT_PUBLIC_GBG_GRAPH_RENDERER);
}
