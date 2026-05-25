'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphRenderEdge, GraphRenderNode } from '@/domain/game';
import {
  GraphLayoutEdge,
  GraphLayoutNode,
  GraphPosition,
  calculateGraphViewportTransform,
  createGraphLayoutData,
  getGraphEdgeDistance,
  getGraphEdgeStrokeWidth,
} from '@/domain/graphLayout';

type SimulationNode = GraphLayoutNode & d3.SimulationNodeDatum;

type SimulationEdge = Omit<GraphLayoutEdge, 'source' | 'target'> & d3.SimulationLinkDatum<SimulationNode> & {
  source: string | SimulationNode;
  target: string | SimulationNode;
};

interface GraphData {
  nodes: SimulationNode[];
  edges: SimulationEdge[];
}

const BACKGROUND_ALPHA_TARGET = 0.018;
const DATA_CHANGE_ALPHA_TARGET = 0.06;
const INTERACTION_ALPHA_TARGET = 0.12;

interface SimpleConceptGraphProps {
  nodes: GraphRenderNode[];
  edges: GraphRenderEdge[];
  width?: number;
  height?: number;
  interactionsDisabled?: boolean;
  onNodeClick: (nodeId: string) => void;
  onAddSourceNode: (nodeId: string) => void;
  onRemoveSourceNode: (nodeId: string) => void;
}

function buildGraphData(
  renderNodes: GraphRenderNode[],
  renderEdges: GraphRenderEdge[],
  previousPositions: Map<string, GraphPosition>,
  width: number,
  height: number
): GraphData {
  return createGraphLayoutData({
    nodes: renderNodes,
    edges: renderEdges,
    previousPositions,
    width,
    height,
  });
}

export default function SimpleConceptGraph({
  nodes,
  edges,
  width = 800,
  height = 600,
  interactionsDisabled = false,
  onNodeClick,
  onAddSourceNode,
  onRemoveSourceNode,
}: SimpleConceptGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const linkGroupRef = useRef<SVGGElement>(null);
  const nodeGroupRef = useRef<SVGGElement>(null);
  const actionGroupRef = useRef<SVGGElement>(null);
  const labelGroupRef = useRef<SVGGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationEdge> | null>(null);
  const positionsRef = useRef<Map<string, GraphPosition>>(new Map());
  const hoveredNodeIdRef = useRef<string | null>(null);
  const isDraggingNodeRef = useRef(false);
  const draggedNodeIdRef = useRef<string | null>(null);
  const didDragNodeRef = useRef(false);
  const interactionsDisabledRef = useRef(interactionsDisabled);
  const onNodeClickRef = useRef(onNodeClick);
  const onAddSourceNodeRef = useRef(onAddSourceNode);
  const onRemoveSourceNodeRef = useRef(onRemoveSourceNode);
  const [dimensions, setDimensions] = useState({ width, height });

  useEffect(() => {
    interactionsDisabledRef.current = interactionsDisabled;
    onNodeClickRef.current = onNodeClick;
    onAddSourceNodeRef.current = onAddSourceNode;
    onRemoveSourceNodeRef.current = onRemoveSourceNode;
  }, [interactionsDisabled, onAddSourceNode, onNodeClick, onRemoveSourceNode]);

  useEffect(() => {
    const handleResize = () => {
      const container = svgRef.current?.parentElement;
      setDimensions({
        width: container?.clientWidth || width,
        height: container?.clientHeight || height,
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  const graphData = useMemo(
    () =>
      buildGraphData(
        nodes,
        edges,
        // The D3 simulation stores positions outside React state so layout
        // updates do not re-render on every tick.
        // eslint-disable-next-line react-hooks/refs
        positionsRef.current,
        dimensions.width,
        dimensions.height
      ),
    [dimensions.height, dimensions.width, edges, nodes]
  );

  const activeSourceCount = nodes.filter(node => node.isActiveSource).length;

  const fitGraphToViewport = useCallback((duration = 450) => {
    const viewport = viewportRef.current;
    if (!viewport || graphData.nodes.length === 0 || isDraggingNodeRef.current) return;

    const transform = calculateGraphViewportTransform({
      nodes: graphData.nodes,
      width: dimensions.width,
      height: dimensions.height,
    });
    if (!transform) return;

    d3.select(viewport)
      .interrupt()
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attr('transform', `translate(${transform.translateX},${transform.translateY}) scale(${transform.scale})`);
  }, [dimensions.height, dimensions.width, graphData.nodes]);

  useEffect(() => {
    const linkGroupElement = linkGroupRef.current;
    const nodeGroupElement = nodeGroupRef.current;
    const actionGroupElement = actionGroupRef.current;
    const labelGroupElement = labelGroupRef.current;

    if (!linkGroupElement || !nodeGroupElement || !actionGroupElement || !labelGroupElement) return;

    const linkGroup = d3.select(linkGroupElement);
    const nodeGroup = d3.select(nodeGroupElement);
    const actionGroup = d3.select(actionGroupElement);
    const labelGroup = d3.select(labelGroupElement);

    const links = linkGroup
      .selectAll<SVGLineElement, SimulationEdge>('line')
      .data(graphData.edges, edge => edge.id)
      .join(
        enter =>
          enter
            .append('line')
            .attr('stroke-opacity', 0)
            .attr('stroke', edge => edge.color)
            .attr('stroke-width', edge => getGraphEdgeStrokeWidth(edge))
            .call(enterSelection =>
              enterSelection.transition().duration(180).attr('stroke-opacity', 0.65)
            ),
        update => update
          .attr('stroke', edge => edge.color)
          .attr('stroke-width', edge => getGraphEdgeStrokeWidth(edge)),
        exit => exit.transition().duration(120).attr('stroke-opacity', 0).remove()
      );

    const renderedNodes = nodeGroup
      .selectAll<SVGCircleElement, SimulationNode>('circle')
      .data(graphData.nodes, node => node.id)
      .join(
        enter =>
          enter
            .append('circle')
            .attr('r', 0)
            .attr('fill', node => node.color)
            .style('cursor', interactionsDisabled ? 'default' : 'grab')
            .on('mouseenter', (_event, node) => {
              hoveredNodeIdRef.current = node.id;
              updateNodeStyles();
            })
            .on('mouseleave', () => {
              hoveredNodeIdRef.current = null;
              updateNodeStyles();
            })
            .on('click', (_event, node) => {
              if (draggedNodeIdRef.current === node.id) return;
              if (interactionsDisabledRef.current) return;
              onNodeClickRef.current(node.id);
            })
            .call(enterSelection =>
              enterSelection.transition().duration(180).attr('r', node => node.radius)
            ),
        update => update
          .attr('fill', node => node.color)
          .style('cursor', interactionsDisabled ? 'default' : 'grab'),
        exit => exit.transition().duration(120).attr('r', 0).remove()
      );

    const actions = actionGroup
      .selectAll<SVGGElement, SimulationNode>('g')
      .data(graphData.nodes, node => node.id)
      .join(
        enter => {
          const group = enter
            .append('g')
            .style('cursor', 'pointer');

          group.append('circle').attr('r', 7).attr('fill', '#FFFFFF').attr('stroke', '#6B7280');
          group
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 4)
            .attr('font-size', 11)
            .attr('font-weight', 700)
            .attr('fill', '#374151');

          return group;
        },
        update => update,
        exit => exit.remove()
      );

    actions
      .on('click', (event, node) => {
        event.stopPropagation();
        if (interactionsDisabledRef.current) return;
        if (node.isActiveSource && activeSourceCount > 1) {
          onRemoveSourceNodeRef.current(node.id);
        } else if (!node.isActiveSource) {
          onAddSourceNodeRef.current(node.id);
        }
      })
      .style('display', node => (
        interactionsDisabled || (node.isActiveSource && activeSourceCount <= 1) ? 'none' : 'block'
      ))
      .select('text')
      .text(node => (node.isActiveSource ? '-' : '+'));

    const labels = labelGroup
      .selectAll<SVGTextElement, SimulationNode>('text')
      .data(graphData.nodes, node => node.id)
      .join(
        enter =>
          enter
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', node => node.radius + 15)
            .attr('font-size', 12)
            .attr('paint-order', 'stroke')
            .attr('stroke', 'white')
            .attr('stroke-width', 4)
            .attr('stroke-linejoin', 'round')
            .attr('fill', '#111827')
            .style('pointer-events', 'none')
            .text(node => node.label),
        update => update
          .text(node => node.label)
          .attr('dy', node => node.radius + 15)
          .style('pointer-events', 'none'),
        exit => exit.remove()
      );

    const nodeDrag = d3
      .drag<SVGCircleElement, SimulationNode>()
      .clickDistance(4)
      .on('start', (event, node) => {
        if (interactionsDisabledRef.current) return;

        isDraggingNodeRef.current = true;
        didDragNodeRef.current = false;
        draggedNodeIdRef.current = null;
        d3.select(viewportRef.current).interrupt();

        if (!event.active) {
          simulationRef.current?.alphaTarget(INTERACTION_ALPHA_TARGET).restart();
        }

        node.fx = node.x ?? dimensions.width / 2;
        node.fy = node.y ?? dimensions.height / 2;
      })
      .on('drag', (event, node) => {
        if (interactionsDisabledRef.current) return;

        didDragNodeRef.current = true;
        node.fx = event.x;
        node.fy = event.y;
        positionsRef.current.set(node.id, {
          x: event.x,
          y: event.y,
        });
      })
      .on('end', (event, node) => {
        if (interactionsDisabledRef.current) return;

        isDraggingNodeRef.current = false;
        node.fx = null;
        node.fy = null;

        if (!event.active) {
          simulationRef.current?.alphaTarget(BACKGROUND_ALPHA_TARGET).restart();
        }

        if (didDragNodeRef.current) {
          draggedNodeIdRef.current = node.id;
          window.setTimeout(() => {
            if (draggedNodeIdRef.current === node.id) {
              draggedNodeIdRef.current = null;
            }
          }, 0);
          window.setTimeout(() => fitGraphToViewport(450), 80);
        }
      });

    renderedNodes.call(nodeDrag);

    function updateNodeStyles() {
      renderedNodes
        .attr('stroke', node => {
          if (node.isSelected) return '#7C3AED';
          if (node.isActiveSource) return '#16A34A';
          if (node.id === hoveredNodeIdRef.current) return '#111827';
          if (node.isRoot) return '#92400E';
          return 'white';
        })
        .attr('stroke-width', node => {
          if (node.isSelected || node.isActiveSource) return 4;
          if (node.id === hoveredNodeIdRef.current || node.isRoot) return 3;
          return 1.5;
        });

      labels.style('display', 'block');
    }

    updateNodeStyles();

    let simulation = simulationRef.current;
    if (!simulation) {
      simulation = d3
        .forceSimulation<SimulationNode>(graphData.nodes)
        .force(
          'link',
          d3
            .forceLink<SimulationNode, SimulationEdge>(graphData.edges)
            .id(node => node.id)
            .distance(edge => getGraphEdgeDistance(edge))
            .strength(0.75)
        )
        .force('charge', d3.forceManyBody<SimulationNode>().strength(-260))
        .force('collide', d3.forceCollide<SimulationNode>().radius(node => node.radius + 22).strength(0.85))
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.06))
        .alphaDecay(0.035)
        .velocityDecay(0.42);

      simulationRef.current = simulation;
    } else {
      simulation.nodes(graphData.nodes);
      simulation.force(
        'link',
        d3
          .forceLink<SimulationNode, SimulationEdge>(graphData.edges)
          .id(node => node.id)
          .distance(edge => getGraphEdgeDistance(edge))
          .strength(0.75)
      );
      simulation.force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.06));
    }

    simulation.on('tick', () => {
      links
        .attr('x1', edge => (edge.source as SimulationNode).x || dimensions.width / 2)
        .attr('y1', edge => (edge.source as SimulationNode).y || dimensions.height / 2)
        .attr('x2', edge => (edge.target as SimulationNode).x || dimensions.width / 2)
        .attr('y2', edge => (edge.target as SimulationNode).y || dimensions.height / 2);

      renderedNodes
        .attr('cx', node => node.x || dimensions.width / 2)
        .attr('cy', node => node.y || dimensions.height / 2)
        .each(node => {
          positionsRef.current.set(node.id, {
            x: node.x || dimensions.width / 2,
            y: node.y || dimensions.height / 2,
          });
        });

      actions.attr(
        'transform',
        node => `translate(${(node.x || dimensions.width / 2) + node.radius},${(node.y || dimensions.height / 2) - node.radius})`
      );

      labels.attr(
        'transform',
        node => `translate(${node.x || dimensions.width / 2},${node.y || dimensions.height / 2})`
      );
    });

    simulation.alphaTarget(DATA_CHANGE_ALPHA_TARGET).restart();
    const coolTimer = window.setTimeout(() => {
      simulation?.alphaTarget(BACKGROUND_ALPHA_TARGET).restart();
    }, 450);
    const fitTimer = window.setTimeout(() => fitGraphToViewport(500), 120);

    return () => {
      window.clearTimeout(coolTimer);
      window.clearTimeout(fitTimer);
    };
  }, [activeSourceCount, dimensions.height, dimensions.width, fitGraphToViewport, graphData, interactionsDisabled]);

  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full min-h-[500px] w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50">
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="h-full w-full">
        <g ref={viewportRef}>
          <g ref={linkGroupRef} />
          <g ref={nodeGroupRef} />
          <g ref={actionGroupRef} />
          <g ref={labelGroupRef} />
        </g>
      </svg>
    </div>
  );
}
