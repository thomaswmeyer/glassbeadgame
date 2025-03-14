import React, { useEffect, useRef, useState, memo, useCallback } from 'react';

interface Node {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  targetX?: number;
  targetY?: number;
  color: string;
  size: number;
  isOriginal?: boolean;
  isCurrent?: boolean;
  isNew?: boolean;
  connections?: string[]; // IDs of connected nodes
  degree?: number; // Number of connections
  idealAngles?: Map<string, number>; // Map of connected node IDs to their ideal angles
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

// Calculate angle for distributing connections evenly
const calculateIdealAngle = (index: number, total: number) => {
  return (Math.PI * 2 * index) / total;
};

// Initial force simulation to position nodes
const forceSimulation = (nodes: Node[], links: Link[], iterations = 300, existingNodePositions = new Map<string, {x: number, y: number}>()) => {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  // Initialize positions if not set, preserving existing positions
  nodes.forEach(node => {
    const existingPosition = existingNodePositions.get(node.id);
    if (existingPosition) {
      // Use existing position for nodes that already exist
      node.x = existingPosition.x;
      node.y = existingPosition.y;
      node.isNew = false;
    } else {
      // Initialize new nodes with random positions
      node.x = Math.random() * 400;
      node.y = Math.random() * 400;
      node.isNew = true;
    }
    // Initialize velocity
    node.vx = 0;
    node.vy = 0;
    // Initialize connections array and ideal angles map
    node.connections = [];
    node.degree = 0;
    node.idealAngles = new Map();
  });

  // Build connection information
  links.forEach(link => {
    const sourceNode = nodeMap.get(link.source);
    const targetNode = nodeMap.get(link.target);
    
    if (sourceNode && targetNode) {
      if (!sourceNode.connections) sourceNode.connections = [];
      if (!targetNode.connections) targetNode.connections = [];
      
      sourceNode.connections.push(targetNode.id);
      targetNode.connections.push(sourceNode.id);
      
      sourceNode.degree = (sourceNode.degree || 0) + 1;
      targetNode.degree = (targetNode.degree || 0) + 1;
    }
  });

  // Calculate ideal angles for each node's connections
  nodes.forEach(node => {
    if (!node.connections || node.connections.length <= 1) return;
    
    // Get connected nodes
    const connectedNodeIds = node.connections;
    
    // Calculate and store ideal angles for each connection
    connectedNodeIds.forEach((connectedId, index) => {
      const idealAngle = calculateIdealAngle(index, connectedNodeIds.length);
      if (!node.idealAngles) node.idealAngles = new Map();
      node.idealAngles.set(connectedId, idealAngle);
    });
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

        // Only move nodes that are new or connected to new nodes
        if (nodeA.isNew) {
          nodeA.x -= fx;
          nodeA.y -= fy;
        }
        if (nodeB.isNew) {
          nodeB.x += fx;
          nodeB.y += fy;
        }
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

        // Only move nodes that are new or connected to new nodes
        if (sourceNode.isNew || targetNode.isNew) {
          if (sourceNode.isNew) {
            sourceNode.x += fx;
            sourceNode.y += fy;
          }
          if (targetNode.isNew) {
            targetNode.x -= fx;
            targetNode.y -= fy;
          }
        }
      }
    });

    // Apply angular forces to distribute connections evenly
    if (i > iterations / 2) { // Apply in later iterations after basic layout is formed
      nodes.forEach(node => {
        if (!node.connections || node.connections.length <= 1 || !node.idealAngles) return;
        
        // Get connected nodes
        node.connections.forEach(connectedId => {
          const connectedNode = nodeMap.get(connectedId);
          if (!connectedNode) return;
          
          // Get the ideal angle for this connection
          const idealAngle = node.idealAngles?.get(connectedId);
          if (idealAngle === undefined) return;
          
          // Calculate current angle
          const dx = connectedNode.x - node.x;
          const dy = connectedNode.y - node.y;
          const currentAngle = Math.atan2(dy, dx);
          
          // Calculate angular difference
          let angleDiff = idealAngle - currentAngle;
          // Normalize to [-π, π]
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
          
          // Calculate force strength (stronger for larger differences)
          const forceStrength = 0.1 * Math.min(1, Math.abs(angleDiff) / Math.PI);
          
          // Calculate distance between nodes
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Calculate new position based on ideal angle
          const idealX = node.x + distance * Math.cos(idealAngle);
          const idealY = node.y + distance * Math.sin(idealAngle);
          
          // Apply force towards ideal position
          if (connectedNode.isNew) {
            connectedNode.x += (idealX - connectedNode.x) * forceStrength;
            connectedNode.y += (idealY - connectedNode.y) * forceStrength;
          }
        });
      });
    }
  }

  // Store the calculated positions as target positions
  nodes.forEach(node => {
    node.targetX = node.x;
    node.targetY = node.y;
  });

  return { nodes, links };
};

// Function to fit the graph to the viewport
const fitGraphToView = (nodes: Node[], width: number, height: number, padding = 50) => {
  if (nodes.length === 0) return nodes;

  // Find the bounds of the graph
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(node => {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  });

  // Calculate the scale to fit the graph within the viewport
  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const scaleX = (width - padding * 2) / (graphWidth || 1);
  const scaleY = (height - padding * 2) / (graphHeight || 1);
  const scale = Math.min(scaleX, scaleY);

  // Calculate the center of the graph
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Update the target positions of the nodes
  nodes.forEach(node => {
    node.targetX = (node.x - centerX) * scale + width / 2;
    node.targetY = (node.y - centerY) * scale + height / 2;
  });

  return nodes;
};

// Function to apply angular forces during animation
const applyAngularForces = (nodes: Node[], nodeMap: Map<string, Node>) => {
  nodes.forEach(node => {
    if (!node.connections || node.connections.length <= 1 || !node.idealAngles) return;
    
    // Apply angular forces to each connected node
    node.connections.forEach(connectedId => {
      const connectedNode = nodeMap.get(connectedId);
      if (!connectedNode) return;
      
      // Get the ideal angle for this connection
      const idealAngle = node.idealAngles?.get(connectedId);
      if (idealAngle === undefined) return;
      
      // Calculate current angle
      const dx = connectedNode.x - node.x;
      const dy = connectedNode.y - node.y;
      const currentAngle = Math.atan2(dy, dx);
      
      // Calculate angular difference
      let angleDiff = idealAngle - currentAngle;
      // Normalize to [-π, π]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      // Calculate force strength (stronger for larger differences)
      const forceStrength = 0.03 * Math.min(1, Math.abs(angleDiff) / Math.PI);
      
      // Calculate distance between nodes
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      
      // Calculate new position based on ideal angle
      const idealX = node.x + distance * Math.cos(idealAngle);
      const idealY = node.y + distance * Math.sin(idealAngle);
      
      // Apply force towards ideal position by updating velocity
      if (!connectedNode.vx) connectedNode.vx = 0;
      if (!connectedNode.vy) connectedNode.vy = 0;
      
      connectedNode.vx += (idealX - connectedNode.x) * forceStrength;
      connectedNode.vy += (idealY - connectedNode.y) * forceStrength;
    });
  });
  
  return nodes;
};

const SimpleConceptGraph = memo(({ gameHistory, originalTopic, currentTopic, width = 400, height = 400 }: SimpleConceptGraphProps) => {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const isAnimating = useRef<boolean>(false);
  const nodePositionsRef = useRef<Map<string, {x: number, y: number}>>(new Map());
  const prevGameHistoryLengthRef = useRef<number>(0);
  const nodeMapRef = useRef<Map<string, Node>>(new Map());

  // Function to build graph data from game history
  useEffect(() => {
    if (!gameHistory.length && !originalTopic) return;

    // Store current node positions before updating
    const existingNodePositions = new Map<string, {x: number, y: number}>();
    graphData.nodes.forEach(node => {
      existingNodePositions.set(node.id, { x: node.x, y: node.y });
    });
    nodePositionsRef.current = existingNodePositions;

    // Check if we're just adding a new node or completely rebuilding
    const isAddingNode = gameHistory.length === prevGameHistoryLengthRef.current + 1;
    prevGameHistoryLengthRef.current = gameHistory.length;

    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeIds = new Set<string>();

    // Add original topic as the first node
    nodes.push({
      id: originalTopic,
      x: width / 2,
      y: height / 4,
      vx: 0,
      vy: 0,
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
        vx: 0,
        vy: 0,
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
          vx: 0,
          vy: 0,
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

    // Run force simulation to position nodes, preserving existing positions
    const simulatedData = forceSimulation(nodes, links, 300, nodePositionsRef.current);
    
    // Fit the graph to the viewport
    fitGraphToView(simulatedData.nodes, width, height);
    
    // Start animation only if we're adding a new node
    isAnimating.current = true;
    
    // Update node map for animation
    const nodeMap = new Map<string, Node>();
    simulatedData.nodes.forEach(node => nodeMap.set(node.id, node));
    nodeMapRef.current = nodeMap;
    
    // Update graph data
    setGraphData(simulatedData);
  }, [gameHistory, originalTopic, currentTopic, width, height, graphData.nodes]);

  // Animation loop using requestAnimationFrame
  const animate = useCallback(() => {
    setGraphData(prevData => {
      const updatedNodes = [...prevData.nodes];
      let stillAnimating = false;
      
      // Create node map for quick lookups
      const nodeMap = new Map<string, Node>();
      updatedNodes.forEach(node => nodeMap.set(node.id, node));
      
      // Apply angular forces to maintain even distribution
      applyAngularForces(updatedNodes, nodeMap);
      
      // Update node positions with spring physics
      updatedNodes.forEach(node => {
        if (node.targetX !== undefined && node.targetY !== undefined) {
          // Spring force
          const springFactor = 0.08;
          const dampingFactor = 0.8;
          
          // Calculate spring force
          const dx = node.targetX - node.x;
          const dy = node.targetY - node.y;
          
          // Update velocity with spring force and damping
          if (!node.vx) node.vx = 0;
          if (!node.vy) node.vy = 0;
          
          node.vx = node.vx * dampingFactor + dx * springFactor;
          node.vy = node.vy * dampingFactor + dy * springFactor;
          
          // Update position
          node.x += node.vx;
          node.y += node.vy;
          
          // Check if still animating
          const isMoving = Math.abs(node.vx) > 0.01 || Math.abs(node.vy) > 0.01;
          stillAnimating = stillAnimating || isMoving;
        }
      });
      
      // Continue or stop animation
      isAnimating.current = stillAnimating;
      
      return { nodes: updatedNodes, links: prevData.links };
    });
    
    // Continue animation if needed
    if (isAnimating.current) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, []);

  // Start/stop animation
  useEffect(() => {
    if (isAnimating.current && !animationRef.current) {
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [animate, graphData]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = Math.min(500, Math.max(300, containerWidth * 0.8));
        
        // Recalculate node positions to fit the new viewport
        setGraphData(prevData => {
          const updatedNodes = [...prevData.nodes];
          fitGraphToView(updatedNodes, containerWidth, containerHeight);
          isAnimating.current = true;
          return { nodes: updatedNodes, links: prevData.links };
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
                y={node.y + nodeSize + 5}
                textAnchor="middle"
                dominantBaseline="hanging"
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