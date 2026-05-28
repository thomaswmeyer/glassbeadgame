'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  GraphPosition,
  GraphViewportTransform,
  calculateGraphViewportTransform,
  createGraphLayoutData,
  getGraphEdgeDistance,
} from '@/domain/graphLayout';
import SvgConceptGraphRenderer from './SvgConceptGraphRenderer';
import WebGlConceptGraphRenderer from './WebGlConceptGraphRenderer';
import {
  ConceptGraphRendererProps,
  GraphData,
  GraphRendererKind,
  SimulationEdge,
  SimulationNode,
  getConfiguredGraphRendererKind,
  getNextGraphRendererKind,
} from './graphRendererTypes';

type ConceptGraphProps = ConceptGraphRendererProps & {
  renderer?: GraphRendererKind;
};

const graphRenderers = {
  svg: SvgConceptGraphRenderer,
  webgl: WebGlConceptGraphRenderer,
};

const BACKGROUND_ALPHA_TARGET = 0.018;
const DATA_CHANGE_ALPHA_TARGET = 0.06;
const GRAPH_LAYOUT_DISTANCE_SCALE = 2;

const INITIAL_TRANSFORM: GraphViewportTransform = {
  translateX: 0,
  translateY: 0,
  scale: 1,
};

export default function ConceptGraph({
  renderer = getConfiguredGraphRendererKind(),
  ...props
}: ConceptGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef<Map<string, GraphPosition>>(new Map());
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationEdge> | null>(null);
  const [activeRenderer, setActiveRenderer] = useState(renderer);
  const [dimensions, setDimensions] = useState({
    width: props.width ?? 800,
    height: props.height ?? 600,
  });
  const [transform, setTransform] = useState<GraphViewportTransform>(INITIAL_TRANSFORM);
  const [frameVersion, setFrameVersion] = useState(0);
  const [graphData, setGraphData] = useState<GraphData>(() => createGraphLayoutData({
    nodes: props.nodes,
    edges: props.edges,
    previousPositions: new Map(),
    width: props.width ?? 800,
    height: props.height ?? 600,
  }) as GraphData);

  useEffect(() => {
    setActiveRenderer(renderer);
  }, [renderer]);

  useEffect(() => {
    const updateDimensions = () => {
      const container = containerRef.current;
      setDimensions({
        width: container?.clientWidth || props.width || 800,
        height: container?.clientHeight || props.height || 600,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [props.height, props.width]);

  useEffect(() => {
    setGraphData(createGraphLayoutData({
      nodes: props.nodes,
      edges: props.edges,
      previousPositions: positionsRef.current,
      width: dimensions.width,
      height: dimensions.height,
    }) as GraphData);
  }, [dimensions.height, dimensions.width, props.edges, props.nodes]);

  const fitGraphToViewport = useCallback((duration = 0) => {
    if (graphData.nodes.length === 0) return;

    const nextTransform = calculateGraphViewportTransform({
      nodes: graphData.nodes,
      width: dimensions.width,
      height: dimensions.height,
    });
    if (!nextTransform) return;

    const applyTransform = () => setTransform(nextTransform);
    if (duration > 0) {
      window.setTimeout(applyTransform, Math.min(duration, 120));
    } else {
      applyTransform();
    }
  }, [dimensions.height, dimensions.width, graphData.nodes]);

  useEffect(() => {
    let simulation = simulationRef.current;
    if (!simulation) {
      simulation = d3
        .forceSimulation<SimulationNode>(graphData.nodes)
        .force(
          'link',
          d3
            .forceLink<SimulationNode, SimulationEdge>(graphData.edges)
            .id(node => node.id)
            .distance(edge => getGraphEdgeDistance(edge) * GRAPH_LAYOUT_DISTANCE_SCALE)
            .strength(0.75)
        )
        .force('charge', d3.forceManyBody<SimulationNode>().strength(-520))
        .force(
          'collide',
          d3
            .forceCollide<SimulationNode>()
            .radius(node => (node.radius + 22) * GRAPH_LAYOUT_DISTANCE_SCALE)
            .strength(0.85)
        )
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
          .distance(edge => getGraphEdgeDistance(edge) * GRAPH_LAYOUT_DISTANCE_SCALE)
          .strength(0.75)
      );
      simulation.force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.06));
    }

    simulation.on('tick', () => {
      graphData.nodes.forEach(node => {
        positionsRef.current.set(node.id, {
          x: node.x || dimensions.width / 2,
          y: node.y || dimensions.height / 2,
        });
      });
      setFrameVersion(version => version + 1);
    });

    simulation.alphaTarget(DATA_CHANGE_ALPHA_TARGET).restart();
    const coolTimer = window.setTimeout(() => {
      simulation?.alphaTarget(BACKGROUND_ALPHA_TARGET).restart();
    }, 450);
    const fitTimer = window.setTimeout(() => fitGraphToViewport(450), 120);

    return () => {
      window.clearTimeout(coolTimer);
      window.clearTimeout(fitTimer);
      simulation?.on('tick', null);
    };
  }, [dimensions.height, dimensions.width, fitGraphToViewport, graphData]);

  useEffect(() => {
    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditableTarget = target instanceof HTMLElement && (
        target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      );

      if (isEditableTarget || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'g') return;

      setActiveRenderer(currentRenderer => getNextGraphRendererKind(currentRenderer));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const Renderer = graphRenderers[activeRenderer];
  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[500px] w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50"
    >
      <Renderer
        {...props}
        graphData={graphData}
        dimensions={dimensions}
        transform={transform}
        frameVersion={frameVersion}
        positionsRef={positionsRef}
        simulationRef={simulationRef}
        fitGraphToViewport={fitGraphToViewport}
        setFrameVersion={setFrameVersion}
      />
    </div>
  );
}
