'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { GameHistory } from './GameInterface';

// Define interfaces for our graph data
interface Node {
  id: string;
  label: string;
  size: number;
  color: string;
  isCurrent?: boolean;
  isOriginal?: boolean;
  isSelected?: boolean;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  color: string;
  width: number;
  isCustom?: boolean;
  semanticDistance?: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
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

// Create a stable reference to store D3 selections
const selectionsRef = {
  svg: null as d3.Selection<SVGSVGElement, unknown, null, undefined> | null,
  nodeGroup: null as d3.Selection<SVGGElement, unknown, null, undefined> | null,
  linkGroup: null as d3.Selection<SVGGElement, unknown, null, undefined> | null,
  labelGroup: null as d3.Selection<SVGGElement, unknown, null, undefined> | null,
  nodes: null as d3.Selection<SVGCircleElement, Node, SVGGElement, unknown> | null,
  links: null as d3.Selection<SVGLineElement, Link, SVGGElement, unknown> | null,
  labels: null as d3.Selection<SVGGElement, Node, SVGGElement, unknown> | null,
};

// Create a stable reference for the simulation
const simulationRef = {
  current: null as d3.Simulation<Node, Link> | null
};

// Create a stable reference for node positions
const nodePositionsRef = new Map<string, {x: number, y: number}>();

// Create a stable reference for hovered node
const hoveredNodeRef = {
  current: null as Node | null
};

// Create a stable reference for initialization state
const isInitializedRef = {
  current: false
};

// Create a stable reference for previous graph data
const graphDataRef = {
  current: null as GraphData | null
};

export default function SimpleConceptGraph({
  gameHistory,
  originalTopic,
  currentTopic,
  width = 800,
  height = 600,
  selectedNode,
  connections,
  onNodeClick
}: SimpleConceptGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipContent, setTooltipContent] = useState<{title: string, content: string} | null>(null);

  // Create a stable reference to onNodeClick callback
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const container = svgRef.current.parentElement;
        if (container) {
          setDimensions({
            width: container.clientWidth || width,
            height: container.clientHeight || height
          });
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);

  // Function to fit the graph in the viewport
  const fitGraph = useCallback((svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, nodes: d3.Selection<SVGCircleElement, Node, SVGGElement, unknown>, width: number, height: number) => {
    if (!nodes || nodes.empty()) return;

    // Reset any existing transform first
    svg.selectAll('g').attr('transform', null);

    // Get the bounds of all nodes
    const bounds = nodes.nodes().reduce((acc, node) => {
      const x = +node.getAttribute('cx')!;
      const y = +node.getAttribute('cy')!;
      const r = +node.getAttribute('r')!;
      
      // Include more padding for labels and interactions
      const nodePadding = r + 60; // Increased padding for labels and interaction space
      
      return {
        minX: Math.min(acc.minX, x - nodePadding),
        maxX: Math.max(acc.maxX, x + nodePadding),
        minY: Math.min(acc.minY, y - nodePadding),
        maxY: Math.max(acc.maxY, y + nodePadding)
      };
    }, {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity
    });

    // Calculate the graph dimensions including padding
    const padding = Math.max(width, height) * 0.1; // Dynamic padding based on viewport size
    const graphWidth = bounds.maxX - bounds.minX + (padding * 2);
    const graphHeight = bounds.maxY - bounds.minY + (padding * 2);
    
    // Calculate scale to fit the viewport while maintaining aspect ratio
    const scaleX = width / graphWidth;
    const scaleY = height / graphHeight;
    const scale = Math.min(scaleX, scaleY, 0.9); // Limit scale to 0.9 to ensure some breathing room
    
    // Calculate translation to center the graph
    const translateX = ((width / scale) - (bounds.maxX + bounds.minX)) / 2;
    const translateY = ((height / scale) - (bounds.maxY + bounds.minY)) / 2;

    // Apply transform to all elements
    svg.selectAll('g')
      .attr('transform', `scale(${scale}) translate(${translateX},${translateY})`);

  }, []);

  // Initialize and update the graph visualization
  const initAndUpdateGraph = useCallback(() => {
    if (!svgRef.current) return;
    
    const { width, height } = dimensions;
    
    // Calculate new graph data
    const newGraphData = buildGraphData(gameHistory, originalTopic, currentTopic, connections, selectedNode);
    
    // Skip if no data
    if (newGraphData.nodes.length === 0) return;
    
    // Deep compare with previous data to detect actual changes
    let dataChanged = false;
    if (!graphDataRef.current || 
        graphDataRef.current.nodes.length !== newGraphData.nodes.length || 
        graphDataRef.current.links.length !== newGraphData.links.length) {
      dataChanged = true;
    }
    
    // Store new data for future comparisons
    graphDataRef.current = newGraphData;
    
    // First-time initialization
    if (!isInitializedRef.current) {
      // Create SVG container
      const svg = d3.select(svgRef.current);
      selectionsRef.svg = svg;
      
      // Create groups for links and nodes
      const linkGroup = svg.append('g');
      const nodeGroup = svg.append('g');
      const labelGroup = svg.append('g');
      
      selectionsRef.linkGroup = linkGroup;
      selectionsRef.nodeGroup = nodeGroup;
      selectionsRef.labelGroup = labelGroup;
      
      // Create links
      const links = linkGroup
        .selectAll<SVGLineElement, Link>('line')
        .data(newGraphData.links, d => `${(d.source as any).id}-${(d.target as any).id}`)
        .join('line')
        .attr('stroke', d => d.color)
        .attr('stroke-width', d => d.width)
        .attr('stroke-dasharray', d => d.isCustom ? '5,3' : '0')
        .attr('stroke-opacity', 0.6);
      
      selectionsRef.links = links;
      
      // Create nodes
      const nodes = nodeGroup
        .selectAll<SVGCircleElement, Node>('circle')
        .data(newGraphData.nodes, d => d.id)
        .join('circle')
        .attr('r', d => d.size)
        .attr('fill', d => d.color)
        .attr('cx', d => {
          const pos = nodePositionsRef.get(d.id);
          return pos ? pos.x : width / 2;
        })
        .attr('cy', d => {
          const pos = nodePositionsRef.get(d.id);
          return pos ? pos.y : height / 2;
        })
        .attr('stroke', d => {
          if (d.isCurrent) return '#38A169';
          if (d.isOriginal) return '#DD6B20';
          if (d.isSelected) return '#805AD5';
          return 'none';
        })
        .attr('stroke-width', d => 
          (d.isCurrent || d.isOriginal || d.isSelected) ? 3 : 0
        )
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
          handleMouseOver(d);
        })
        .on('mouseout', function() {
          handleMouseOut();
        })
        .on('click', function(event, d) {
          handleNodeClick(d);
        });
      
      selectionsRef.nodes = nodes;
      
      // Create force simulation
      const simulation = d3.forceSimulation<Node>(newGraphData.nodes)
        .force('link', d3.forceLink<Node, Link>(newGraphData.links)
          .id(d => d.id)
          .distance(link => 50 + (link.semanticDistance || 5) * 10)
        )
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide<Node>().radius(d => d.size + 10))
        .alpha(1)
        .alphaDecay(0.01) // Slower decay
        .alphaMin(0.001) // Lower minimum alpha to allow more movement
        .on('tick', () => {
          // Update links
          if (selectionsRef.links) {
            selectionsRef.links
              .attr('x1', d => (d.source as Node).x || width / 2)
              .attr('y1', d => (d.source as Node).y || height / 2)
              .attr('x2', d => (d.target as Node).x || width / 2)
              .attr('y2', d => (d.target as Node).y || height / 2);
          }
          
          // Update nodes
          if (selectionsRef.nodes) {
            selectionsRef.nodes
              .attr('cx', d => d.x || width / 2)
              .attr('cy', d => d.y || height / 2);
          }
          
          // Update labels
          if (selectionsRef.labels) {
            selectionsRef.labels
              .attr('transform', d => `translate(${d.x || width / 2},${d.y || height / 2})`);
          }
        })
        .on('end', () => {
          // When simulation ends, calculate bounds and fit viewport
          if (selectionsRef.nodes && selectionsRef.svg) {
            const nodeElements = selectionsRef.nodes.nodes();
            const bounds = {
              minX: Infinity,
              maxX: -Infinity,
              minY: Infinity,
              maxY: -Infinity
            };
            
            // Calculate bounds including node sizes
            nodeElements.forEach(node => {
              const x = +node.getAttribute('cx')!;
              const y = +node.getAttribute('cy')!;
              const r = +node.getAttribute('r')!;
              
              bounds.minX = Math.min(bounds.minX, x - r);
              bounds.maxX = Math.max(bounds.maxX, x + r);
              bounds.minY = Math.min(bounds.minY, y - r);
              bounds.maxY = Math.max(bounds.maxY, y + r);
            });
            
            // Add padding
            const padding = 50;
            bounds.minX -= padding;
            bounds.maxX += padding;
            bounds.minY -= padding;
            bounds.maxY += padding;
            
            // Calculate scale to fit viewport
            const graphWidth = bounds.maxX - bounds.minX;
            const graphHeight = bounds.maxY - bounds.minY;
            const scaleX = width / graphWidth;
            const scaleY = height / graphHeight;
            const scale = Math.min(scaleX, scaleY);
            
            // Calculate translation to center
            const translateX = -bounds.minX * scale + (width - graphWidth * scale) / 2;
            const translateY = -bounds.minY * scale + (height - graphHeight * scale) / 2;
            
            // Apply transform without transition for initial positioning
            selectionsRef.svg.selectAll('g')
              .attr('transform', `translate(${translateX},${translateY}) scale(${scale})`);
            
            // Store final positions
            selectionsRef.nodes.each(function(d) {
              nodePositionsRef.set(d.id, { x: d.x || width / 2, y: d.y || height / 2 });
            });
          }
        });
      
      simulationRef.current = simulation;
      isInitializedRef.current = true;
    } 
    // Update existing simulation with new data if necessary
    else if (dataChanged && simulationRef.current && selectionsRef.svg) {
      // Update links
      if (selectionsRef.linkGroup) {
        const links = selectionsRef.linkGroup
          .selectAll<SVGLineElement, Link>('line')
          .data(newGraphData.links, d => `${(d.source as any).id}-${(d.target as any).id}`);
        
        // Remove old links
        links.exit().remove();
        
        // Add new links
        const enterLinks = links.enter()
          .append('line')
          .attr('stroke', d => d.color)
          .attr('stroke-width', d => d.width)
          .attr('stroke-dasharray', d => d.isCustom ? '5,3' : '0')
          .attr('stroke-opacity', 0.6);
        
        // Merge with existing links
        selectionsRef.links = enterLinks.merge(links);
      }
      
      // Update nodes
      if (selectionsRef.nodeGroup) {
        const nodes = selectionsRef.nodeGroup
          .selectAll<SVGCircleElement, Node>('circle')
          .data(newGraphData.nodes, d => d.id);
        
        // Remove old nodes
        nodes.exit().remove();
        
        // Add new nodes
        const enterNodes = nodes.enter()
          .append('circle')
          .attr('r', d => d.size)
          .attr('fill', d => d.color)
          .attr('cx', d => {
            const pos = nodePositionsRef.get(d.id);
            return pos ? pos.x : width / 2;
          })
          .attr('cy', d => {
            const pos = nodePositionsRef.get(d.id);
            return pos ? pos.y : height / 2;
          })
          .attr('stroke', d => {
            if (d.isCurrent) return '#38A169';
            if (d.isOriginal) return '#DD6B20';
            if (d.isSelected) return '#805AD5';
            return 'none';
          })
          .attr('stroke-width', d => 
            (d.isCurrent || d.isOriginal || d.isSelected) ? 3 : 0
          )
          .style('cursor', 'pointer')
          .on('mouseover', function(event, d) {
            handleMouseOver(d);
          })
          .on('mouseout', function() {
            handleMouseOut();
          })
          .on('click', function(event, d) {
            handleNodeClick(d);
          });
        
        // Merge with existing nodes
        selectionsRef.nodes = enterNodes.merge(nodes);
        
        // Update existing nodes' visual properties
        selectionsRef.nodes
          .attr('fill', d => d.color)
          .attr('stroke', d => {
            if (d.isCurrent) return '#38A169';
            if (d.isOriginal) return '#DD6B20';
            if (d.isSelected) return '#805AD5';
            return 'none';
          })
          .attr('stroke-width', d => 
            (d.isCurrent || d.isOriginal || d.isSelected) ? 3 : 0
          );
      }
      
      // Update labels
      if (selectionsRef.labelGroup) {
        const labels = selectionsRef.labelGroup
          .selectAll<SVGGElement, Node>('g')
          .data(newGraphData.nodes, d => d.id);
        
        // Remove old labels
        labels.exit().remove();
        
        // Add new labels
        const enterLabels = labels.enter()
          .append('g')
          .attr('transform', d => {
            const pos = nodePositionsRef.get(d.id);
            return `translate(${pos ? pos.x : 0},${pos ? pos.y : 0})`;
          })
          .style('display', d => 
            d.isOriginal || d.isCurrent || d.isSelected ? 'block' : 'none'
          );
        
        // Add label text and background
        enterLabels.each(function(d) {
          const label = d.id.split('-').slice(2).join('-') || originalTopic;
          const g = d3.select(this);
          
          const text = g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d.size + 16)
            .attr('font-size', '12px')
            .text(label);
          
          const textWidth = (text.node() as SVGTextElement)?.getComputedTextLength() || 0;
          
          g.insert('rect', 'text')
            .attr('x', -textWidth / 2 - 4)
            .attr('y', d.size + 4)
            .attr('width', textWidth + 8)
            .attr('height', 20)
            .attr('fill', 'rgba(255, 255, 255, 0.8)')
            .attr('rx', 3);
        });
        
        // Merge with existing labels
        selectionsRef.labels = enterLabels.merge(labels);
        
        // Update label display based on node state
        selectionsRef.labels
          .style('display', d => 
            d.isOriginal || d.isCurrent || d.isSelected || d === hoveredNodeRef.current 
              ? 'block' 
              : 'none'
          );
      }
      
      // Update simulation with new data
      simulationRef.current
        .nodes(newGraphData.nodes)
        .force('link', d3.forceLink<Node, Link>(newGraphData.links)
          .id(d => d.id)
          .distance(link => 50 + (link.semanticDistance || 5) * 10)
        );
      
      // Restart simulation with full energy
      simulationRef.current
        .alpha(1)
        .alphaDecay(0.02)
        .restart();
    }
    
    // Update node and label styling based on current state
    if (selectionsRef.nodes && selectionsRef.labels) {
      selectionsRef.nodes
        .attr('stroke', d => {
          if (d === hoveredNodeRef.current) return '#4299E1';
          if (d.isCurrent) return '#38A169';
          if (d.isOriginal) return '#DD6B20';
          if (d.isSelected) return '#805AD5';
          return 'none';
        })
        .attr('stroke-width', d => {
          if (d === hoveredNodeRef.current) return 2;
          return (d.isCurrent || d.isOriginal || d.isSelected) ? 3 : 0;
        });
      
      selectionsRef.labels
        .style('display', d => 
          d.isOriginal || d.isCurrent || d.isSelected || d === hoveredNodeRef.current
            ? 'block' 
            : 'none'
        );
    }
    
  }, [gameHistory, originalTopic, currentTopic, selectedNode, connections, dimensions]);

  // Handle mouse events
  const handleMouseOver = useCallback((node: Node) => {
    hoveredNodeRef.current = node;
    setTooltipVisible(true);
    setTooltipContent({
      title: node.id.split('-').slice(2).join('-') || originalTopic,
      content: `This node represents ${node.id.split('-').slice(2).join('-') || originalTopic}`
    });
  }, [originalTopic]);

  const handleMouseOut = useCallback(() => {
    hoveredNodeRef.current = null;
    setTooltipVisible(false);
  }, []);

  const handleNodeClick = useCallback((node: Node) => {
    onNodeClickRef.current(node.id);
  }, []);

  // Initialize and update graph on mount and when dependencies change
  useEffect(() => {
    initAndUpdateGraph();
  }, [initAndUpdateGraph]);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full bg-gray-50"
      />
      {tooltipVisible && tooltipContent && (
        <div
          className="absolute bg-white shadow-lg rounded-md p-3 z-50 border border-gray-200 text-sm"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            maxWidth: '300px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}
        >
          <h4 className="font-medium text-blue-800 mb-2">{tooltipContent.title}</h4>
          <p className="text-gray-600">{tooltipContent.content}</p>
        </div>
      )}
    </div>
  );
}

// Helper function to build graph data
function buildGraphData(
  gameHistory: GameHistory[],
  originalTopic: string,
  currentTopic: string,
  connections: {from: number, to: number}[],
  selectedNode: string | null
): GraphData {
  const nodes: Node[] = [];
  const links: Link[] = [];
  
  // Add original topic node
  nodes.push({
    id: `original-${originalTopic}`,
    label: originalTopic,
    color: '#FFD700', // Gold color for original topic
    size: 15,
    isOriginal: true
  });
  
  // Add nodes and links for each history item
  let prevNodeId = `original-${originalTopic}`;
  
  gameHistory.forEach((item, index) => {
    // Create node for the response
    const nodeId = `response-${index}-${item.response}`;
    const isSelected = Boolean(selectedNode && 
      selectedNode === nodeId);
    
    nodes.push({
      id: nodeId,
      label: item.response,
      color: item.player === 'human' ? '#4299E1' : '#F56565', // Blue for human, red for AI
      size: 12,
      isCurrent: item.response === currentTopic,
      isSelected
    });
    
    // Create link from previous node to this node
    links.push({
      source: prevNodeId,
      target: nodeId,
      color: '#A0AEC0', // Gray color for links
      width: 2,
      semanticDistance: item.scores.semanticDistance || 5,
      isCustom: false // Default value for regular connections
    });
    
    prevNodeId = nodeId;
  });
  
  // Add custom connections if provided
  if (connections && connections.length > 0) {
    connections.forEach(connection => {
      if (connection.from >= 0 && connection.from < gameHistory.length &&
          connection.to >= 0 && connection.to < gameHistory.length) {
        
        const sourceNodeId = `response-${connection.from}-${gameHistory[connection.from].response}`;
        const targetNodeId = `response-${connection.to}-${gameHistory[connection.to].response}`;
        
        // Check if nodes exist
        const sourceExists = nodes.some(node => node.id === sourceNodeId);
        const targetExists = nodes.some(node => node.id === targetNodeId);
        
        if (sourceExists && targetExists) {
          links.push({
            source: sourceNodeId,
            target: targetNodeId,
            color: '#805AD5', // Purple color for custom connections
            width: 2,
            semanticDistance: 5, // Default values
            isCustom: true
          });
        }
      }
    });
  }
  
  return { nodes, links };
}
