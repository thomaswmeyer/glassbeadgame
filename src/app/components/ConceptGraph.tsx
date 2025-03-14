import React, { useEffect, useRef, useState, memo } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Graph with no SSR to avoid server-side rendering issues
const Graph = dynamic(() => import('react-d3-graph').then(mod => mod.Graph), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-500">Loading graph visualization...</div>
    </div>
  )
});

interface Node {
  id: string;
  color: string;
  size: number;
  symbolType?: string;
  fontColor?: string;
  fontSize?: number;
  fontWeight?: number;
  labelPosition?: string;
  renderLabel?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  isOriginal?: boolean;
  isCurrent?: boolean;
}

interface Link {
  source: string;
  target: string;
  color: string;
  strokeWidth: number;
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

interface ConceptGraphProps {
  gameHistory: GameHistoryItem[];
  originalTopic: string;
  currentTopic: string;
  width?: number;
  height?: number;
}

// Memoize the component to prevent unnecessary re-renders
const ConceptGraph = memo(({ gameHistory, originalTopic, currentTopic, width = 400, height = 400 }: ConceptGraphProps) => {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width, height });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        setDimensions({
          width: containerWidth,
          height: Math.min(500, Math.max(300, containerWidth * 0.8))
        });
      }
    };

    // Initial sizing
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Function to build graph data from game history
  useEffect(() => {
    if (!gameHistory.length && !originalTopic) return;

    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeIds = new Set<string>();

    // Add original topic as the first node
    nodes.push({
      id: originalTopic,
      color: '#4299e1', // Blue color for original topic
      size: 700, // Larger size for the original topic
      symbolType: 'circle',
      fontColor: '#2b6cb0',
      fontSize: 14,
      fontWeight: 700,
      renderLabel: true,
      strokeColor: '#2b6cb0',
      strokeWidth: 2,
      isOriginal: true
    });
    nodeIds.add(originalTopic);

    // Add current topic if different from original
    if (currentTopic && currentTopic !== originalTopic) {
      nodes.push({
        id: currentTopic,
        color: '#f6ad55', // Orange color for current topic
        size: 600, // Slightly smaller than original but larger than responses
        symbolType: 'circle',
        fontColor: '#dd6b20',
        fontSize: 14,
        fontWeight: 700,
        renderLabel: true,
        strokeColor: '#dd6b20',
        strokeWidth: 2,
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
          color: item.player === 'human' ? '#63b3ed' : '#fc8181', // Blue for human, red for AI
          size: 400, // Standard size for responses
          symbolType: 'circle',
          fontColor: '#4a5568',
          fontSize: 12,
          renderLabel: true,
          strokeColor: item.player === 'human' ? '#3182ce' : '#e53e3e',
          strokeWidth: 1
        });
        nodeIds.add(item.response);
      }

      // Create link from topic to response
      const semanticDistance = item.scores.currentConnection?.semanticDistance || 
                              item.scores.semanticDistance || 5;
      const similarity = item.scores.currentConnection?.similarity || 
                        item.scores.relevanceQuality || 5;
      
      // Calculate link properties
      // Link width based on similarity
      const linkWidth = similarity / 2; // Scale to reasonable values
      
      links.push({
        source: previousTopic,
        target: item.response,
        color: item.player === 'human' ? 'rgba(99, 179, 237, 0.6)' : 'rgba(252, 129, 129, 0.6)',
        strokeWidth: linkWidth,
        semanticDistance,
        similarity
      });

      // If this is the final round and there's a connection back to original topic
      if (item.scores.originalConnection && originalTopic !== previousTopic) {
        const originalSemanticDistance = item.scores.originalConnection.semanticDistance;
        const originalSimilarity = item.scores.originalConnection.similarity;
        
        // Calculate link properties for connection to original topic
        const originalLinkWidth = originalSimilarity / 2;
        
        links.push({
          source: item.response,
          target: originalTopic,
          color: 'rgba(246, 173, 85, 0.6)', // Orange for connection back to original
          strokeWidth: originalLinkWidth,
          semanticDistance: originalSemanticDistance,
          similarity: originalSimilarity
        });
      }

      // Update previous topic for next iteration
      previousTopic = item.response;
    });

    setGraphData({ nodes, links });
  }, [gameHistory, originalTopic, currentTopic]);

  // Handle node click
  const onClickNode = (nodeId: string) => {
    setSelectedNode(selectedNode === nodeId ? null : nodeId);
  };

  // Graph configuration
  const graphConfig = {
    nodeHighlightBehavior: true,
    directed: true,
    d3: {
      gravity: -150,
      linkLength: (link: any) => {
        // Use semantic distance to determine link length
        // Higher semantic distance = longer link
        const distance = 100 + (10 - (link.semanticDistance || 5)) * 20;
        return distance;
      },
      linkStrength: 1,
      alphaTarget: 0.1,
    },
    node: {
      color: '#d3d3d3',
      size: 400,
      highlightStrokeColor: 'blue',
      highlightStrokeWidth: 2,
      highlightFontSize: 14,
      highlightFontWeight: 'bold',
      labelProperty: 'id',
      labelPosition: 'center',
      renderLabel: true,
      fontSize: 12,
      fontColor: '#333',
      symbolType: 'circle',
    },
    link: {
      color: '#d3d3d3',
      highlightColor: '#4a5568',
      strokeWidth: 1.5,
      type: 'STRAIGHT',
      renderLabel: false,
    },
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
      
      {typeof window !== 'undefined' && (
        <div style={{ height: dimensions.height, width: dimensions.width }}>
          <Graph
            id="concept-graph"
            data={graphData}
            config={graphConfig}
            onClickNode={onClickNode}
          />
        </div>
      )}
    </div>
  );
});

export default ConceptGraph; 