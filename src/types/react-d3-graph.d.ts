declare module 'react-d3-graph' {
  export interface GraphNode {
    id: string;
    [key: string]: any;
  }

  export interface GraphLink {
    source: string;
    target: string;
    [key: string]: any;
  }

  export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
  }

  export interface GraphConfig {
    nodeHighlightBehavior?: boolean;
    directed?: boolean;
    d3?: {
      gravity?: number;
      linkLength?: number | ((link: any) => number);
      linkStrength?: number;
      alphaTarget?: number;
      [key: string]: any;
    };
    node?: {
      color?: string;
      size?: number;
      highlightStrokeColor?: string;
      highlightStrokeWidth?: number;
      highlightFontSize?: number;
      highlightFontWeight?: string;
      labelProperty?: string;
      labelPosition?: string;
      renderLabel?: boolean;
      fontSize?: number;
      fontColor?: string;
      symbolType?: string;
      [key: string]: any;
    };
    link?: {
      color?: string;
      highlightColor?: string;
      strokeWidth?: number;
      type?: string;
      renderLabel?: boolean;
      [key: string]: any;
    };
    [key: string]: any;
  }

  export interface GraphProps {
    id: string;
    data: GraphData;
    config?: GraphConfig;
    onClickNode?: (nodeId: string) => void;
    onClickLink?: (source: string, target: string) => void;
    onMouseOverNode?: (nodeId: string) => void;
    onMouseOutNode?: (nodeId: string) => void;
    onMouseOverLink?: (source: string, target: string) => void;
    onMouseOutLink?: (source: string, target: string) => void;
    [key: string]: any;
  }

  export class Graph extends React.Component<GraphProps> {}
} 