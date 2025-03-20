import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { GameHistory } from '../components/GameInterface';
import * as d3 from 'd3';

// Define our node type
interface Node {
  id: string;
  color: string;
  size: number;
  isOriginal?: boolean;
  isCurrent?: boolean;
  isSelected?: boolean;
  historyItem?: GameHistory; // Reference to the original history item
  // D3 simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  index?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  color: string;
  width: number;
  semanticDistance: number;
  similarity: number;
  isCustom: boolean;
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
  connections?: {from: number, to: number}[]; // Custom connections between nodes
  onNodeClick?: (historyItem: GameHistory) => void; // Callback for node click
  selectedNode?: GameHistory | null; // Currently selected node
}

// Add a more effective memo comparison function
function arePropsEqual(prevProps: SimpleConceptGraphProps, nextProps: SimpleConceptGraphProps) {
  // Only re-render if these props change
  return (
    prevProps.gameHistory === nextProps.gameHistory &&
    prevProps.originalTopic === nextProps.originalTopic &&
    prevProps.currentTopic === nextProps.currentTopic &&
    prevProps.selectedNode === nextProps.selectedNode &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    areConnectionsEqual(prevProps.connections, nextProps.connections) &&
    prevProps.onNodeClick === nextProps.onNodeClick
  );
}

// Helper to compare connections arrays
function areConnectionsEqual(prev?: {from: number, to: number}[], next?: {from: number, to: number}[]) {
  if (!prev && !next) return true;
  if (!prev || !next) return false;
  if (prev.length !== next.length) return false;
  
  // Compare each connection
  return prev.every((conn, i) => 
    conn.from === next[i].from && conn.to === next[i].to
  );
}

// Function to build graph data from game history - kept outside component to ensure stability
function buildGraphData(
  gameHistory: GameHistory[], 
  originalTopic: string, 
  currentTopic: string,
  customConnections?: {from: number, to: number}[],
  selectedNode?: GameHistory | null
): GraphData {
  const nodes: Node[] = [];
  const links: Link[] = [];
  
  // Add original topic node
  nodes.push({
    id: `original-${originalTopic}`,
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
      selectedNode.round === item.round && 
      selectedNode.response === item.response);
    
    nodes.push({
      id: nodeId,
      color: item.player === 'human' ? '#4299E1' : '#F56565', // Blue for human, red for AI
      size: 12,
      isCurrent: item.response === currentTopic,
      isSelected,
      historyItem: item
    });
    
    // Create link from previous node to this node
    links.push({
      source: prevNodeId,
      target: nodeId,
      color: '#A0AEC0', // Gray color for links
      width: 2,
      semanticDistance: item.scores.semanticDistance || 5,
      similarity: item.scores.relevanceQuality || 5,
      isCustom: false // Default value for regular connections
    });
    
    prevNodeId = nodeId;
  });
  
  // Add custom connections if provided
  if (customConnections && customConnections.length > 0) {
    customConnections.forEach(connection => {
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
            similarity: 5,
            isCustom: true
          });
        }
      }
    });
  }
  
  return { nodes, links };
}

// Define the component base
const SimpleConceptGraphBase: React.FC<SimpleConceptGraphProps> = ({
  gameHistory,
  originalTopic,
  currentTopic,
  width = 450,
  height = 500,
  connections = [],
  onNodeClick,
  selectedNode
}) => {
  // Use ref for the SVG DOM element
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Use refs for persistent state that shouldn't trigger re-renders
  const isInitializedRef = useRef<boolean>(false);
  const simulationRef = useRef<d3.Simulation<Node, d3.SimulationLinkDatum<Node>> | null>(null);
  const hoveredNodeRef = useRef<Node | null>(null);
  
  // Create a ref to store D3 selections to avoid re-creating them
  const selectionsRef = useRef<{
    svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined> | null;
    linkGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null;
    nodeGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null;
    labelGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null;
    links: d3.Selection<SVGLineElement, Link, SVGGElement, unknown> | null;
    nodes: d3.Selection<SVGCircleElement, Node, SVGGElement, unknown> | null;
    labels: d3.Selection<SVGGElement, Node, SVGGElement, unknown> | null;
  }>({
    svg: null,
    linkGroup: null,
    nodeGroup: null,
    labelGroup: null,
    links: null,
    nodes: null,
    labels: null
  });
  
  // Store previous graph data to detect actual changes
  const graphDataRef = useRef<GraphData | null>(null);
  
  // Create a stable reference to onNodeClick callback
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);
  
  // Handle hover effects via direct DOM manipulation
  const handleMouseOver = useCallback((d: Node) => {
    if (!selectionsRef.current?.svg) return;
    
    hoveredNodeRef.current = d;
    
    // Update circle highlights
    selectionsRef.current.nodes?.each(function(node) {
      const circle = d3.select(this);
      if (node.id === d.id) {
        circle.attr('stroke', '#4299E1').attr('stroke-width', 2);
      }
    });
    
    // Update label visibility
    selectionsRef.current.labels?.each(function(node) {
      const label = d3.select(this);
      if (node.id === d.id || node.isOriginal || node.isCurrent || node.isSelected) {
        label.style('display', 'block');
      } else {
        label.style('display', 'none');
      }
    });
  }, []);
  
  // Handle mouse out effects
  const handleMouseOut = useCallback(() => {
    if (!selectionsRef.current?.svg) return;
    
    hoveredNodeRef.current = null;
    
    // Reset circle highlights
    selectionsRef.current.nodes?.each(function(node) {
      const circle = d3.select(this);
      if (node.isCurrent) {
        circle.attr('stroke', '#38A169').attr('stroke-width', 3);
      } else if (node.isOriginal) {
        circle.attr('stroke', '#DD6B20').attr('stroke-width', 3);
      } else if (node.isSelected) {
        circle.attr('stroke', '#805AD5').attr('stroke-width', 3);
      } else {
        circle.attr('stroke', 'none').attr('stroke-width', 0);
      }
    });
    
    // Update label visibility
    selectionsRef.current.labels?.each(function(node) {
      const label = d3.select(this);
      if (node.isOriginal || node.isCurrent || node.isSelected) {
        label.style('display', 'block');
      } else {
        label.style('display', 'none');
      }
    });
  }, []);
  
  // Handle click callback
  const handleNodeClick = useCallback((d: Node) => {
    if (d.historyItem && onNodeClickRef.current) {
      onNodeClickRef.current(d.historyItem);
    }
  }, []);
  
  // Initialize and update the graph visualization - this is the core D3 integration
  // We're using a deep dependency comparison to avoid recreating the graph unnecessarily
  const initAndUpdateGraph = useCallback(() => {
    if (!svgRef.current) return;
    
    const selection = selectionsRef.current;
    
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
      // Set up basic svg elements
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      
      const linkGroup = svg.append('g').attr('class', 'links');
      const nodeGroup = svg.append('g').attr('class', 'nodes');
      const labelGroup = svg.append('g').attr('class', 'labels');
      
      // Store selections for future updates
      selection.svg = svg;
      selection.linkGroup = linkGroup;
      selection.nodeGroup = nodeGroup;
      selection.labelGroup = labelGroup;
      
      // Set initial positions for stability
      newGraphData.nodes.forEach(node => {
        node.x = width / 2 + (Math.random() - 0.5) * 50;
        node.y = height / 2 + (Math.random() - 0.5) * 50;
        node.fx = null;
        node.fy = null;
      });
      
      // Create initial elements
      const links = linkGroup.selectAll('line')
        .data(newGraphData.links)
        .enter()
        .append('line')
        .attr('stroke', d => d.color)
        .attr('stroke-width', d => d.width)
        .attr('stroke-dasharray', d => d.isCustom ? '5,3' : '0')
        .attr('stroke-opacity', 0.6);
      
      const nodes = nodeGroup.selectAll('circle')
        .data(newGraphData.nodes)
        .enter()
        .append('circle')
        .attr('r', d => d.size)
        .attr('fill', d => d.color)
        .attr('cx', d => d.x ?? width / 2)
        .attr('cy', d => d.y ?? height / 2)
        .attr('stroke', d => {
          if (d.isCurrent) return '#38A169';
          if (d.isOriginal) return '#DD6B20';
          if (d.isSelected) return '#805AD5';
          return 'none';
        })
        .attr('stroke-width', d => 
          (d.isCurrent || d.isOriginal || d.isSelected) ? 3 : 0
        )
        .style('cursor', 'pointer');
      
      // Set up event handlers
      nodes.on('mouseover', function(event, d) {
        handleMouseOver(d);
      })
      .on('mouseout', function() {
        handleMouseOut();
      })
      .on('click', function(event, d) {
        handleNodeClick(d);
      });
      
      // Set up drag behavior
      const drag = d3.drag<SVGCircleElement, Node>()
        .on('start', function(event, d) {
          if (!event.active && simulationRef.current) {
            simulationRef.current.alphaTarget(0.3).restart();
          }
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', function(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', function(event, d) {
          if (!event.active && simulationRef.current) {
            simulationRef.current.alphaTarget(0);
          }
          // Keep nodes fixed where they were dragged
          d.fx = event.x;
          d.fy = event.y;
        });
      
      // Apply drag behavior
      nodes.call(drag as any);
      
      // Create labels
      const labels = labelGroup.selectAll('g')
        .data(newGraphData.nodes)
        .enter()
        .append('g')
        .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
        .style('display', d => 
          d.isOriginal || d.isCurrent || d.isSelected ? 'block' : 'none'
        );
      
      // Add label text and background
      labels.each(function(d) {
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
      
      // Store selections for future updates
      selection.links = links;
      selection.nodes = nodes;
      selection.labels = labels;
      
      // Create and configure the simulation
      const simulation = d3.forceSimulation<Node>(newGraphData.nodes)
        .force('link', d3.forceLink<Node, Link>(newGraphData.links)
          .id(d => d.id)
          .distance(link => 50 + (link.semanticDistance || 5) * 10)
        )
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius((d: any) => d.size + 5))
        .alphaTarget(0)
        .alphaDecay(0.02);
      
      // Set up tick function for animation
      simulation.on('tick', () => {
        // Update link positions
        links
          .attr('x1', d => (d.source as any).x || 0)
          .attr('y1', d => (d.source as any).y || 0)
          .attr('x2', d => (d.target as any).x || 0)
          .attr('y2', d => (d.target as any).y || 0);
        
        // Update node positions
        nodes
          .attr('cx', d => d.x || 0)
          .attr('cy', d => d.y || 0);
        
        // Update label positions
        labels
          .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
      });
      
      // Store simulation reference
      simulationRef.current = simulation;
      
      // Mark as initialized
      isInitializedRef.current = true;
    } 
    // Update existing simulation with new data if necessary
    else if (dataChanged && simulationRef.current && selection.svg) {
      // Update links
      if (selection.linkGroup) {
        const links = selection.linkGroup
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
        selection.links = enterLinks.merge(links);
      }
      
      // Update nodes
      if (selection.nodeGroup) {
        const nodes = selection.nodeGroup
          .selectAll<SVGCircleElement, Node>('circle')
          .data(newGraphData.nodes, d => d.id);
        
        // Remove old nodes
        nodes.exit().remove();
        
        // Add new nodes
        const enterNodes = nodes.enter()
          .append('circle')
          .attr('r', d => d.size)
          .attr('fill', d => d.color)
          .attr('cx', d => d.x ?? width / 2)
          .attr('cy', d => d.y ?? height / 2)
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
        
        // Set up drag behavior
        const drag = d3.drag<SVGCircleElement, Node>()
          .on('start', function(event, d) {
            if (!event.active && simulationRef.current) {
              simulationRef.current.alphaTarget(0.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', function(event, d) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', function(event, d) {
            if (!event.active && simulationRef.current) {
              simulationRef.current.alphaTarget(0);
            }
            // Keep nodes fixed where they were dragged
            d.fx = event.x;
            d.fy = event.y;
          });
        
        // Apply drag behavior
        enterNodes.call(drag as any);
        
        // Merge with existing nodes
        selection.nodes = enterNodes.merge(nodes);
        
        // Update existing nodes' visual properties
        selection.nodes
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
      if (selection.labelGroup) {
        const labels = selection.labelGroup
          .selectAll<SVGGElement, Node>('g')
          .data(newGraphData.nodes, d => d.id);
        
        // Remove old labels
        labels.exit().remove();
        
        // Add new labels
        const enterLabels = labels.enter()
          .append('g')
          .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
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
        selection.labels = enterLabels.merge(labels);
        
        // Update label display based on node state
        selection.labels
          .style('display', d => 
            d.isOriginal || d.isCurrent || d.isSelected || d === hoveredNodeRef.current 
              ? 'block' 
              : 'none'
          );
      }
      
      // Update simulation
      simulationRef.current
        .nodes(newGraphData.nodes)
        .force('link', d3.forceLink<Node, Link>(newGraphData.links)
          .id(d => d.id)
          .distance(link => 50 + (link.semanticDistance || 5) * 10)
        );
      
      // Restart simulation at low alpha to animate the changes without a big reorganization
      simulationRef.current.alpha(0.1).restart();
    }
    
    // Update node and label styling based on current state
    if (selection.nodes && selection.labels) {
      selection.nodes
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
      
      selection.labels
        .style('display', d => 
          d.isOriginal || d.isCurrent || d.isSelected || d === hoveredNodeRef.current
            ? 'block' 
            : 'none'
        );
    }
    
  }, [gameHistory, originalTopic, currentTopic, selectedNode, connections, width, height, handleMouseOver, handleMouseOut, handleNodeClick]);
  
  // Run the initialization and update function when necessary inputs change
  useEffect(() => {
    initAndUpdateGraph();
    
    // Clean up on unmount
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
      isInitializedRef.current = false;
    };
  }, [initAndUpdateGraph]);
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2">Concept Graph</h3>
      <p className="text-sm text-gray-600 mb-2">
        {gameHistory.length === 0 
          ? "The graph will visualize connections between concepts as you play." 
          : "Click on any node to use it as the topic for your next response."}
      </p>
      <svg 
        ref={svgRef} 
        width={width} 
        height={height}
        className="border border-gray-200 rounded cursor-pointer"
      />
      <div className="mt-2 text-xs text-gray-500">
        <div className="flex items-center">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
          <span>Your responses</span>
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 ml-3 mr-1"></span>
          <span>AI responses</span>
        </div>
        <div className="flex items-center mt-1">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
          <span>Original topic</span>
          <span className="inline-block w-3 h-3 border-2 border-green-500 rounded-full ml-3 mr-1"></span>
          <span>Current topic</span>
        </div>
        {connections.length > 0 && (
          <div className="flex items-center mt-1">
            <span className="inline-block w-6 h-0 border border-dashed border-purple-500 mr-1"></span>
            <span>Custom connections</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Add display name
SimpleConceptGraphBase.displayName = 'SimpleConceptGraph';

// Export with our optimized memo
const SimpleConceptGraph = memo(SimpleConceptGraphBase, arePropsEqual);
export default SimpleConceptGraph; 