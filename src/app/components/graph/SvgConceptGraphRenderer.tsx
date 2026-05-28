'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { PointerEvent } from 'react';
import { getGraphEdgeStrokeWidth } from '@/domain/graphLayout';
import {
  SharedGraphRendererProps,
  SimulationEdge,
  SimulationNode,
} from './graphRendererTypes';
import { projectedBeadScreenRadius } from './graphProjection';

type PointerDragState = {
  pointerId: number;
  nodeId: string;
  startX: number;
  startY: number;
  didDrag: boolean;
};

const BACKGROUND_ALPHA_TARGET = 0.018;
const INTERACTION_ALPHA_TARGET = 0.12;
const GRAPH_LABEL_FONT_SIZE = 21.6;
const GRAPH_LABEL_OFFSET = 25;

function resolveEdgeNode(node: string | SimulationNode, nodesById: Map<string, SimulationNode>) {
  return typeof node === 'string' ? nodesById.get(node) : node;
}

function screenPoint(event: { clientX: number; clientY: number }, svg: SVGSVGElement | null) {
  const rect = svg?.getBoundingClientRect();

  return {
    x: event.clientX - (rect?.left || 0),
    y: event.clientY - (rect?.top || 0),
  };
}

function worldPoint(
  point: { x: number; y: number },
  transform: SharedGraphRendererProps['transform']
) {
  return {
    x: (point.x - transform.translateX) / transform.scale,
    y: (point.y - transform.translateY) / transform.scale,
  };
}

function nodeScreenPoint(
  node: Pick<SimulationNode, 'x' | 'y'>,
  transform: SharedGraphRendererProps['transform'],
  fallback: { x: number; y: number }
) {
  return {
    x: (node.x ?? fallback.x) * transform.scale + transform.translateX,
    y: (node.y ?? fallback.y) * transform.scale + transform.translateY,
  };
}

export default function SvgConceptGraphRenderer({
  nodes,
  interactionsDisabled = false,
  onNodeClick,
  onAddSourceNode,
  onRemoveSourceNode,
  graphData,
  dimensions,
  transform,
  positionsRef,
  simulationRef,
  fitGraphToViewport,
  setFrameVersion,
}: SharedGraphRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStateRef = useRef<PointerDragState | null>(null);
  const interactionsDisabledRef = useRef(interactionsDisabled);
  const activeSourceCount = nodes.filter(node => node.isActiveSource).length;
  const nodesById = useMemo(
    () => new Map(graphData.nodes.map(node => [node.id, node])),
    [graphData.nodes]
  );

  useEffect(() => {
    interactionsDisabledRef.current = interactionsDisabled;
  }, [interactionsDisabled]);

  const renderedEdges = useMemo(
    () =>
      graphData.edges
        .map(edge => {
          const source = resolveEdgeNode(edge.source, nodesById);
          const target = resolveEdgeNode(edge.target, nodesById);
          if (!source || !target) return null;

          return {
            edge,
            source,
            target,
          };
        })
        .filter((edge): edge is { edge: SimulationEdge; source: SimulationNode; target: SimulationNode } => Boolean(edge)),
    [graphData.edges, nodesById]
  );
  const renderedNodes = useMemo(() => {
    const fallback = {
      x: dimensions.width / 2,
      y: dimensions.height / 2,
    };
    const graphScale = Math.max(0.001, transform.scale);

    return graphData.nodes.map(node => {
      const point = nodeScreenPoint(node, transform, fallback);
      const visualScreenRadius = projectedBeadScreenRadius(
        node,
        point,
        dimensions.width,
        dimensions.height
      );

      return {
        node,
        visualRadius: visualScreenRadius / graphScale,
      };
    });
  }, [dimensions.height, dimensions.width, graphData.nodes, transform]);

  const handlePointerDown = (event: PointerEvent<SVGCircleElement>, node: SimulationNode) => {
    event.stopPropagation();
    const svg = svgRef.current;
    const point = screenPoint(event, svg);

    svg?.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      nodeId: node.id,
      startX: point.x,
      startY: point.y,
      didDrag: false,
    };

    node.fx = node.x ?? dimensions.width / 2;
    node.fy = node.y ?? dimensions.height / 2;
    simulationRef.current?.alphaTarget(INTERACTION_ALPHA_TARGET).restart();
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const point = screenPoint(event, svgRef.current);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    if (Math.hypot(deltaX, deltaY) > 3) {
      dragState.didDrag = true;
    }

    const node = graphData.nodes.find(item => item.id === dragState.nodeId);
    if (!node) return;

    const world = worldPoint(point, transform);
    node.fx = world.x;
    node.fy = world.y;
    positionsRef.current.set(node.id, world);
    setFrameVersion(version => version + 1);
  };

  const handlePointerUp = () => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    svgRef.current?.releasePointerCapture(dragState.pointerId);
    dragStateRef.current = null;

    const node = graphData.nodes.find(item => item.id === dragState.nodeId);
    if (!node) return;

    node.fx = null;
    node.fy = null;
    simulationRef.current?.alphaTarget(BACKGROUND_ALPHA_TARGET).restart();

    if (!dragState.didDrag && !interactionsDisabledRef.current) {
      onNodeClick(node.id);
    } else {
      window.setTimeout(() => fitGraphToViewport(450), 80);
    }
  };

  return (
    <svg
      ref={svgRef}
      width={dimensions.width}
      height={dimensions.height}
      className="h-full w-full"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <g transform={`translate(${transform.translateX},${transform.translateY}) scale(${transform.scale})`}>
        <g>
          {renderedEdges.map(({ edge, source, target }) => (
            <line
              key={edge.id}
              x1={source.x || dimensions.width / 2}
              y1={source.y || dimensions.height / 2}
              x2={target.x || dimensions.width / 2}
              y2={target.y || dimensions.height / 2}
              stroke={edge.color}
              strokeOpacity={0.65}
              strokeWidth={getGraphEdgeStrokeWidth(edge)}
            />
          ))}
        </g>
        <g>
          {renderedNodes.map(({ node, visualRadius }) => (
            <circle
              key={node.id}
              cx={node.x || dimensions.width / 2}
              cy={node.y || dimensions.height / 2}
              r={visualRadius}
              fill={node.color}
              stroke={node.isSelected || node.isActiveSource ? node.color : 'white'}
              strokeWidth={node.isSelected || node.isActiveSource ? 4 : 1.5}
              className="cursor-grab"
              onPointerDown={event => handlePointerDown(event, node)}
            />
          ))}
        </g>
        {!interactionsDisabled && (
          <g>
            {renderedNodes.map(({ node, visualRadius }) => {
              const canRemove = node.isActiveSource && activeSourceCount > 1;
              const canAdd = !node.isActiveSource;
              if (!canAdd && !canRemove) return null;

              return (
                <g
                  key={node.id}
                  transform={`translate(${(node.x || dimensions.width / 2) + visualRadius},${(node.y || dimensions.height / 2) - visualRadius})`}
                  className="cursor-pointer"
                  onClick={event => {
                    event.stopPropagation();
                    if (canRemove) {
                      onRemoveSourceNode(node.id);
                    } else {
                      onAddSourceNode(node.id);
                    }
                  }}
                >
                  <circle r={7} fill="#FFFFFF" stroke="#6B7280" />
                  <text
                    textAnchor="middle"
                    dy={4}
                    fontSize={11}
                    fontWeight={700}
                    fill="#374151"
                  >
                    {canRemove ? '-' : '+'}
                  </text>
                </g>
              );
            })}
          </g>
        )}
        <g>
          {renderedNodes.map(({ node, visualRadius }) => (
            <text
              key={node.id}
              x={node.x || dimensions.width / 2}
              y={(node.y || dimensions.height / 2) + visualRadius + GRAPH_LABEL_OFFSET}
              textAnchor="middle"
              fontSize={GRAPH_LABEL_FONT_SIZE}
              paintOrder="stroke"
              stroke="white"
              strokeWidth={5}
              strokeLinejoin="round"
              fill="#111827"
              pointerEvents="none"
            >
              {node.label}
            </text>
          ))}
        </g>
      </g>
    </svg>
  );
}
