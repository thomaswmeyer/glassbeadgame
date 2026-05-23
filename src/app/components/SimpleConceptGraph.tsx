'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphRenderEdge, GraphRenderNode } from '@/domain/game';

interface SimulationNode extends GraphRenderNode, d3.SimulationNodeDatum {
  color: string;
  radius: number;
}

interface SimulationEdge extends d3.SimulationLinkDatum<SimulationNode> {
  id: string;
  source: string | SimulationNode;
  target: string | SimulationNode;
  color: string;
  semanticDistanceScore?: number;
}

interface GraphData {
  nodes: SimulationNode[];
  edges: SimulationEdge[];
}

interface SimpleConceptGraphProps {
  nodes: GraphRenderNode[];
  edges: GraphRenderEdge[];
  width?: number;
  height?: number;
  onNodeClick: (nodeId: string) => void;
  onAddSourceNode: (nodeId: string) => void;
  onRemoveSourceNode: (nodeId: string) => void;
}

function getNodeColor(node: GraphRenderNode) {
  if (node.isRoot) return '#D97706';
  if (node.playerKind === 'ai') return '#DC2626';
  return '#2563EB';
}

function buildGraphData(
  renderNodes: GraphRenderNode[],
  renderEdges: GraphRenderEdge[],
  previousPositions: Map<string, { x: number; y: number }>,
  width: number,
  height: number
): GraphData {
  const rootNode = renderNodes.find(node => node.isRoot);
  const rootPosition = previousPositions.get(rootNode?.id || '') || {
    x: width / 2,
    y: height / 2,
  };

  const nodes = renderNodes.map((node, index) => {
    const previousPosition = previousPositions.get(node.id);
    const incomingEdge = renderEdges.find(edge => edge.destinationNodeId === node.id);
    const parentPosition = incomingEdge
      ? previousPositions.get(incomingEdge.sourceNodeId) || rootPosition
      : rootPosition;
    const angle = index * 0.9;
    const seededPosition = previousPosition || {
      x: parentPosition.x + Math.cos(angle) * 72,
      y: parentPosition.y + Math.sin(angle) * 72,
    };

    return {
      ...node,
      color: getNodeColor(node),
      radius: node.isRoot ? 16 : 12,
      x: seededPosition.x,
      y: seededPosition.y,
    };
  });

  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = renderEdges
    .filter(edge => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.destinationNodeId))
    .map(edge => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.destinationNodeId,
      color: '#94A3B8',
      semanticDistanceScore: edge.semanticDistanceScore,
    }));

  return { nodes, edges };
}

export default function SimpleConceptGraph({
  nodes,
  edges,
  width = 800,
  height = 600,
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
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const hoveredNodeIdRef = useRef<string | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const onAddSourceNodeRef = useRef(onAddSourceNode);
  const onRemoveSourceNodeRef = useRef(onRemoveSourceNode);
  const [dimensions, setDimensions] = useState({ width, height });

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
    onAddSourceNodeRef.current = onAddSourceNode;
    onRemoveSourceNodeRef.current = onRemoveSourceNode;
  }, [onAddSourceNode, onNodeClick, onRemoveSourceNode]);

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
    if (!viewport || graphData.nodes.length === 0) return;

    const padding = 48;
    const bounds = graphData.nodes.reduce(
      (acc, node) => {
        const x = node.x || dimensions.width / 2;
        const y = node.y || dimensions.height / 2;
        const radius = node.radius + 42;

        return {
          minX: Math.min(acc.minX, x - radius),
          maxX: Math.max(acc.maxX, x + radius),
          minY: Math.min(acc.minY, y - radius),
          maxY: Math.max(acc.maxY, y + radius),
        };
      },
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    const graphWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const graphHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const scale = Math.min(
      1.1,
      (dimensions.width - padding * 2) / graphWidth,
      (dimensions.height - padding * 2) / graphHeight
    );
    const translateX = dimensions.width / 2 - scale * ((bounds.minX + bounds.maxX) / 2);
    const translateY = dimensions.height / 2 - scale * ((bounds.minY + bounds.maxY) / 2);

    d3.select(viewport)
      .transition()
      .duration(duration)
      .ease(d3.easeCubicOut)
      .attr('transform', `translate(${translateX},${translateY}) scale(${scale})`);
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
            .attr('stroke-width', 2)
            .call(enterSelection =>
              enterSelection.transition().duration(180).attr('stroke-opacity', 0.65)
            ),
        update => update.attr('stroke', edge => edge.color),
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
            .style('cursor', 'pointer')
            .on('mouseenter', (_event, node) => {
              hoveredNodeIdRef.current = node.id;
              updateNodeStyles();
            })
            .on('mouseleave', () => {
              hoveredNodeIdRef.current = null;
              updateNodeStyles();
            })
            .on('click', (_event, node) => {
              onNodeClickRef.current(node.id);
            })
            .call(enterSelection =>
              enterSelection.transition().duration(180).attr('r', node => node.radius)
            ),
        update => update.attr('fill', node => node.color),
        exit => exit.transition().duration(120).attr('r', 0).remove()
      );

    const actions = actionGroup
      .selectAll<SVGGElement, SimulationNode>('g')
      .data(graphData.nodes, node => node.id)
      .join(
        enter => {
          const group = enter
            .append('g')
            .style('cursor', 'pointer')
            .on('click', (event, node) => {
              event.stopPropagation();
              if (node.isActiveSource && activeSourceCount > 1) {
                onRemoveSourceNodeRef.current(node.id);
              } else if (!node.isActiveSource) {
                onAddSourceNodeRef.current(node.id);
              }
            });

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
      .style('display', node => (node.isActiveSource && activeSourceCount <= 1 ? 'none' : 'block'))
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
            .text(node => node.label),
        update => update.text(node => node.label).attr('dy', node => node.radius + 15),
        exit => exit.remove()
      );

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

      labels.style('display', node =>
        node.isSelected || node.isActiveSource || node.id === hoveredNodeIdRef.current || node.isRoot
          ? 'block'
          : 'none'
      );
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
            .distance(edge => 64 + (edge.semanticDistanceScore || 5) * 9)
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
          .distance(edge => 64 + (edge.semanticDistanceScore || 5) * 9)
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
        node => `translate(${(node.x || dimensions.width / 2) + node.radius + 8},${(node.y || dimensions.height / 2) - node.radius - 8})`
      );

      labels.attr(
        'transform',
        node => `translate(${node.x || dimensions.width / 2},${node.y || dimensions.height / 2})`
      );
    });

    simulation.alphaTarget(0.08).restart();
    const coolTimer = window.setTimeout(() => {
      simulation?.alphaTarget(0);
    }, 450);
    const fitTimer = window.setTimeout(() => fitGraphToViewport(500), 120);

    return () => {
      window.clearTimeout(coolTimer);
      window.clearTimeout(fitTimer);
    };
  }, [activeSourceCount, dimensions.height, dimensions.width, fitGraphToViewport, graphData]);

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
