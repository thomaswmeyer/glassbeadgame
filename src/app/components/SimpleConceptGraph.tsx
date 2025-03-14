import React, { useEffect, useRef, useState, memo } from 'react';

interface Node {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  isOriginal?: boolean;
  isCurrent?: boolean;
}

interface Link {
  source: string;
  target: string;
  color: string;
  width: number;
  semanticDistance: number;
  similarity: number;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface GameHistoryItem {
  round: number;
  topic: string;
  response: string;
  scores: {
    semanticDistance?: number;
    relevanceQuality?: number;
    total: number;
    currentConnection?: {
      semanticDistance: number;
      similarity: number;
      subtotal: number;
    };
    originalConnection?: {
      semanticDistance: number;
      similarity: number;
      subtotal: number;
    };
  };
  player: 'human' | 'ai';
}

interface SimpleConceptGraphProps {
  gameHistory: GameHistoryItem[];
  originalTopic: string;
  currentTopic: string;
  width?: number;
  height?: number;
}

// Simple force simulation
const forceSimulation = (nodes: Node[], links: Link[], iterations = 300) => {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  // Initialize positions if not set
  nodes.forEach(node => {
    if (node.x === undefined) node.x = Math.random() * 400;
    if (node.y === undefined) node.y = Math.random() * 400;
  });

  // Run simulation iterations
  for (let i = 0; i < iterations; i++) {
    // Apply repulsive forces between nodes
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const nodeA = nodes[a];
        const nodeB = nodes[b];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 1000 / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        nodeA.x -= fx;
        nodeA.y -= fy;
        nodeB.x += fx;
        nodeB.y += fy;
      }
    }

    // Apply attractive forces for links
    links.forEach(link => {
      const sourceNode = nodeMap.get(link.source);
      const targetNode = nodeMap.get(link.target);
      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Use semantic distance to determine link length
        // Higher semantic distance = longer link
        const idealDistance = 100 + (10 - link.semanticDistance) * 20;
        const force = (distance - idealDistance) / 30;
        
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        sourceNode.x += fx;
        sourceNode.y += fy;
        targetNode.x -= fx;
        targetNode.y -= fy;
      }
    });
  }

  // Center the graph
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const scale = Math.min(400 / (maxX - minX || 1), 400 / (maxY - minY || 1)) * 0.8;

  nodes.forEach(node => {
    node.x = (node.x - centerX) * scale + 200;
    node.y = (node.y - centerY) * scale + 200;
  });

  return { nodes, links };
};

const SimpleConceptGraph = memo(({ gameHistory, originalTopic, currentTopic, width = 400, height = 400 }: SimpleConceptGraphProps) => {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Function to build graph data from game history
  useEffect(() => {
    if (!gameHistory.length && !originalTopic) return;

    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeIds = new Set<string>();

    // Add original topic as the first node
    nodes.push({
      id: originalTopic,
      x: width / 2,
      y: height / 4,
      color: '#4299e1', // Blue color for original topic
      size: 20, // Larger size for the original topic
      isOriginal: true
    });
    nodeIds.add(originalTopic);

    // Add current topic if different from original
    if (currentTopic && currentTopic !== originalTopic) {
      nodes.push({
        id: currentTopic,
        x: width / 2,
        y: height / 2,
        color: '#f6ad55', // Orange color for current topic
        size: 18, // Slightly smaller than original but larger than responses
        isCurrent: true
      });
      nodeIds.add(currentTopic);
    }

    // Process game history to build nodes and links
    let previousTopic = originalTopic;
    
    gameHistory.forEach((item) => {
      // Add response as a node if not already added
      if (!nodeIds.has(item.response)) {
        nodes.push({
          id: item.response,
          x: Math.random() * width,
          y: Math.random() * height,
          color: item.player === 'human' ? '#63b3ed' : '#fc8181', // Blue for human, red for AI
          size: 15, // Standard size for responses
        });
        nodeIds.add(item.response);
      }

      // Create link from topic to response
      const semanticDistance = item.scores.currentConnection?.semanticDistance || 
                              item.scores.semanticDistance || 5;
      const similarity = item.scores.currentConnection?.similarity || 
                        item.scores.relevanceQuality || 5;
      
      // Link width based on similarity
      const linkWidth = similarity / 3; // Scale to reasonable values
      
      links.push({
        source: previousTopic,
        target: item.response,
        color: item.player === 'human' ? 'rgba(99, 179, 237, 0.6)' : 'rgba(252, 129, 129, 0.6)',
        width: linkWidth,
        semanticDistance,
        similarity
      });

      // If this is the final round and there's a connection back to original topic
      if (item.scores.originalConnection && originalTopic !== previousTopic) {
        const originalSemanticDistance = item.scores.originalConnection.semanticDistance;
        const originalSimilarity = item.scores.originalConnection.similarity;
        
        // Calculate link properties for connection to original topic
        const originalLinkWidth = originalSimilarity / 3;
        
        links.push({
          source: item.response,
          target: originalTopic,
          color: 'rgba(246, 173, 85, 0.6)', // Orange for connection back to original
          width: originalLinkWidth,
          semanticDistance: originalSemanticDistance,
          similarity: originalSimilarity
        });
      }

      // Update previous topic for next iteration
      previousTopic = item.response;
    });

    // Run force simulation to position nodes
    const simulatedData = forceSimulation(nodes, links);
    setGraphData(simulatedData);
  }, [gameHistory, originalTopic, currentTopic, width, height]);

  // Handle node click
  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(selectedNode === nodeId ? null : nodeId);
  };

  if (!gameHistory.length && !originalTopic) {
    return <div className="h-full flex items-center justify-center text-gray-500">No game data yet</div>;
  }

  return (
    <div ref={containerRef} className="border rounded-lg overflow-hidden bg-white h-full">
      <div className="p-3 bg-gray-50 border-b">
        <h3 className="font-medium text-gray-700">Concept Connections</h3>
        <p className="text-xs text-gray-500">
          Line length = semantic distance, line width = connection strength
        </p>
      </div>
      
      {/* Legend */}
      <div className="p-2 bg-gray-50 border-b text-xs">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
            <span>Original Topic</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-orange-400 mr-1"></div>
            <span>Current Topic</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-300 mr-1"></div>
            <span>Your Response</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-300 mr-1"></div>
            <span>AI Response</span>
          </div>
        </div>
      </div>
      
      {/* Selected node info */}
      {selectedNode && (
        <div className="p-2 bg-blue-50 border-b text-sm">
          <p className="font-medium">{selectedNode}</p>
          <p className="text-xs text-gray-600">
            {selectedNode === originalTopic 
              ? 'Original starting topic' 
              : selectedNode === currentTopic 
                ? 'Current topic' 
                : 'Response'}
          </p>
        </div>
      )}
      
      {/* SVG Graph */}
      <svg width={width} height={height} className="bg-white">
        {/* Links */}
        {graphData.links.map((link, i) => {
          const sourceNode = graphData.nodes.find(n => n.id === link.source);
          const targetNode = graphData.nodes.find(n => n.id === link.target);
          
          if (!sourceNode || !targetNode) return null;
          
          const isHighlighted = 
            hoveredNode === link.source || 
            hoveredNode === link.target || 
            selectedNode === link.source || 
            selectedNode === link.target;
          
          return (
            <line
              key={`link-${i}`}
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              stroke={link.color}
              strokeWidth={isHighlighted ? link.width * 1.5 : link.width}
              strokeOpacity={isHighlighted ? 0.9 : 0.6}
            />
          );
        })}
        
        {/* Nodes */}
        {graphData.nodes.map((node) => {
          const isHighlighted = hoveredNode === node.id || selectedNode === node.id;
          const nodeSize = isHighlighted ? node.size * 1.2 : node.size;
          
          return (
            <g key={`node-${node.id}`}>
              <circle
                cx={node.x}
                cy={node.y}
                r={nodeSize}
                fill={node.color}
                stroke={
                  node.isOriginal 
                    ? '#2b6cb0' 
                    : node.isCurrent 
                      ? '#dd6b20' 
                      : isHighlighted 
                        ? '#4a5568' 
                        : 'none'
                }
                strokeWidth={isHighlighted ? 2 : 1}
                onClick={() => handleNodeClick(node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isHighlighted || node.isOriginal || node.isCurrent ? 12 : 10}
                fontWeight={isHighlighted || node.isOriginal || node.isCurrent ? 'bold' : 'normal'}
                fill="#333"
                pointerEvents="none"
              >
                {node.id.length > 20 ? `${node.id.substring(0, 17)}...` : node.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});

export default SimpleConceptGraph; 