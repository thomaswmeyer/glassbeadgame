'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GameHistory } from './GameInterface';

type GraphNodeKind = 'root' | 'response';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  color: string;
  radius: number;
  kind: GraphNodeKind;
  historyIndex?: number;
  player?: 'human' | 'ai';
  isCurrent: boolean;
  isSelected: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  color: string;
  width: number;
  isCustom?: boolean;
  semanticDistance?: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface SimpleConceptGraphProps {
  gameHistory: GameHistory[];
  originalTopic: string;
  currentTopic: string;
  width?: number;
  height?: number;
  selectedNode: string | null;
  connections: {from: number, to: number}[];
  onNodeClick: (nodeId: string) => void;
}

const ROOT_NODE_ID = 'root';

function responseNodeId(index: number) {
  return `response-${index}`;
}

function buildGraphData(
  gameHistory: GameHistory[],
  originalTopic: string,
  currentTopic: string,
  connections: {from: number, to: number}[],
  selectedNode: string | null,
  previousPositions: Map<string, { x: number; y: number }>,
  width: number,
  height: number
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  const rootPosition = previousPositions.get(ROOT_NODE_ID) || {
    x: width / 2,
    y: height / 2,
  };

  nodes.push({
    id: ROOT_NODE_ID,
    label: originalTopic || 'Original topic',
    color: '#D97706',
    radius: 16,
    kind: 'root',
    isCurrent: currentTopic === originalTopic,
    isSelected: selectedNode === ROOT_NODE_ID,
    x: rootPosition.x,
    y: rootPosition.y,
  });

  let previousNodeId = ROOT_NODE_ID;

  gameHistory.forEach((item, index) => {
    const id = responseNodeId(index);
    const previousPosition = previousPositions.get(id);
    const parentPosition = previousPositions.get(previousNodeId) || rootPosition;
    const angle = index * 0.9;
    const seededPosition = previousPosition || {
      x: parentPosition.x + Math.cos(angle) * 72,
      y: parentPosition.y + Math.sin(angle) * 72,
    };

    nodes.push({
      id,
      label: item.response,
      color: item.player === 'human' ? '#2563EB' : '#DC2626',
      radius: 12,
      kind: 'response',
      historyIndex: index,
      player: item.player,
      isCurrent: item.response === currentTopic,
      isSelected: selectedNode === id,
      x: seededPosition.x,
      y: seededPosition.y,
    });

    links.push({
      id: `${previousNodeId}->${id}`,
      source: previousNodeId,
      target: id,
      color: '#94A3B8',
      width: 2,
      semanticDistance: item.scores.semanticDistance || 5,
    });

    previousNodeId = id;
  });

  connections.forEach(connection => {
    if (
      connection.from >= 0 &&
      connection.from < gameHistory.length &&
      connection.to >= 0 &&
      connection.to < gameHistory.length
    ) {
      const source = responseNodeId(connection.from);
      const target = responseNodeId(connection.to);

      links.push({
        id: `${source}->${target}:custom`,
        source,
        target,
        color: '#7C3AED',
        width: 2,
        semanticDistance: 5,
        isCustom: true,
      });
    }
  });

  return { nodes, links };
}

export default function SimpleConceptGraph({
  gameHistory,
  originalTopic,
  currentTopic,
  width = 800,
  height = 600,
  selectedNode,
  connections,
  onNodeClick,
}: SimpleConceptGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const linkGroupRef = useRef<SVGGElement>(null);
  const nodeGroupRef = useRef<SVGGElement>(null);
  const labelGroupRef = useRef<SVGGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const hoveredNodeIdRef = useRef<string | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const [dimensions, setDimensions] = useState({ width, height });

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

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
        gameHistory,
        originalTopic,
        currentTopic,
        connections,
        selectedNode,
        // The D3 simulation stores positions outside React state so layout
        // updates do not re-render on every tick.
        // eslint-disable-next-line react-hooks/refs
        positionsRef.current,
        dimensions.width,
        dimensions.height
      ),
    [connections, currentTopic, dimensions.height, dimensions.width, gameHistory, originalTopic, selectedNode]
  );

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
    const svgElement = svgRef.current;
    const viewportElement = viewportRef.current;
    const linkGroupElement = linkGroupRef.current;
    const nodeGroupElement = nodeGroupRef.current;
    const labelGroupElement = labelGroupRef.current;

    if (!svgElement || !viewportElement || !linkGroupElement || !nodeGroupElement || !labelGroupElement) {
      return;
    }

    const linkGroup = d3.select(linkGroupElement);
    const nodeGroup = d3.select(nodeGroupElement);
    const labelGroup = d3.select(labelGroupElement);

    const links = linkGroup
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(graphData.links, link => link.id)
      .join(
        enter =>
          enter
            .append('line')
            .attr('stroke-opacity', 0)
            .attr('stroke', link => link.color)
            .attr('stroke-width', link => link.width)
            .attr('stroke-dasharray', link => (link.isCustom ? '5 4' : null))
            .call(enterSelection =>
              enterSelection.transition().duration(180).attr('stroke-opacity', 0.65)
            ),
        update =>
          update
            .attr('stroke', link => link.color)
            .attr('stroke-width', link => link.width)
            .attr('stroke-dasharray', link => (link.isCustom ? '5 4' : null)),
        exit => exit.transition().duration(120).attr('stroke-opacity', 0).remove()
      );

    const nodes = nodeGroup
      .selectAll<SVGCircleElement, GraphNode>('circle')
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

    const labels = labelGroup
      .selectAll<SVGTextElement, GraphNode>('text')
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
      nodes
        .attr('stroke', node => {
          if (node.isSelected) return '#7C3AED';
          if (node.id === hoveredNodeIdRef.current) return '#111827';
          if (node.isCurrent) return '#16A34A';
          if (node.kind === 'root') return '#92400E';
          return 'white';
        })
        .attr('stroke-width', node => {
          if (node.isSelected) return 4;
          if (node.id === hoveredNodeIdRef.current || node.isCurrent || node.kind === 'root') return 3;
          return 1.5;
        });

      labels.style('display', node =>
        node.isSelected || node.id === hoveredNodeIdRef.current || node.isCurrent || node.kind === 'root'
          ? 'block'
          : 'none'
      );
    }

    updateNodeStyles();

    let simulation = simulationRef.current;
    if (!simulation) {
      simulation = d3
        .forceSimulation<GraphNode>(graphData.nodes)
        .force(
          'link',
          d3
            .forceLink<GraphNode, GraphLink>(graphData.links)
            .id(node => node.id)
            .distance(link => 64 + (link.semanticDistance || 5) * 9)
            .strength(link => (link.isCustom ? 0.35 : 0.75))
        )
        .force('charge', d3.forceManyBody<GraphNode>().strength(-260))
        .force('collide', d3.forceCollide<GraphNode>().radius(node => node.radius + 20).strength(0.85))
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.06))
        .alphaDecay(0.035)
        .velocityDecay(0.42);

      simulationRef.current = simulation;
    } else {
      simulation.nodes(graphData.nodes);
      simulation.force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(graphData.links)
          .id(node => node.id)
          .distance(link => 64 + (link.semanticDistance || 5) * 9)
          .strength(link => (link.isCustom ? 0.35 : 0.75))
      );
      simulation.force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.06));
    }

    simulation.on('tick', () => {
      links
        .attr('x1', link => (link.source as GraphNode).x || dimensions.width / 2)
        .attr('y1', link => (link.source as GraphNode).y || dimensions.height / 2)
        .attr('x2', link => (link.target as GraphNode).x || dimensions.width / 2)
        .attr('y2', link => (link.target as GraphNode).y || dimensions.height / 2);

      nodes
        .attr('cx', node => node.x || dimensions.width / 2)
        .attr('cy', node => node.y || dimensions.height / 2)
        .each(node => {
          positionsRef.current.set(node.id, {
            x: node.x || dimensions.width / 2,
            y: node.y || dimensions.height / 2,
          });
        });

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
  }, [dimensions.height, dimensions.width, fitGraphToViewport, graphData]);

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
          <g ref={labelGroupRef} />
        </g>
      </svg>
    </div>
  );
}
