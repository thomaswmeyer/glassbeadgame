'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent } from 'react';
import {
  getGraphEdgeStrokeWidth,
  getGraphNodeBeadRadius,
} from '@/domain/graphLayout';
import {
  GraphData,
  SharedGraphRendererProps,
  SimulationNode,
} from './graphRendererTypes';
import {
  projectedBeadScreenRadius,
  shaderFloorPointForScreenPoint,
  shaderScreenPointForWorldPoint,
} from './graphProjection';

type PointerDragState = {
  pointerId: number;
  nodeId: string;
  startX: number;
  startY: number;
  didDrag: boolean;
};

type WebGlResources = {
  gl: WebGLRenderingContext;
  backgroundProgram: WebGLProgram;
  backgroundPositionBuffer: WebGLBuffer;
};

const INTERACTION_ALPHA_TARGET = 0.12;
const BACKGROUND_ALPHA_TARGET = 0.018;
const MAX_SHADER_BEADS = 24;
const MAX_SHADER_CONNECTIONS = 72;
const MAX_SHADER_CONTROLS = 24;
const GRAPH_LABEL_FONT_SIZE = 21.6;
const GRAPH_LABEL_GAP = -6;
const NORTHEAST_DIAGONAL = Math.SQRT1_2;
const CONTROL_RADIAL_FACTOR = 0.68;
const CONTROL_GLYPH_SIZE = 18;
const BACKGROUND_VERTEX_SHADER = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;
const WOOD_BACKGROUND_FRAGMENT_SHADER = `
  precision mediump float;

  uniform vec2 u_resolution;
  uniform vec2 u_graphTranslate;
  uniform float u_graphScale;
  uniform int u_nodeCount;
  uniform vec3 u_centers[24];
  uniform vec3 u_absorb[24];
  uniform vec2 u_nodeInfo[24];
  uniform int u_connectionCount;
  uniform vec3 u_connectionA[72];
  uniform vec3 u_connectionB[72];
  uniform vec3 u_connectionColor[72];
  uniform vec3 u_connectionInfo[72];
  uniform int u_controlCount;
  uniform vec4 u_control[24];
  uniform float u_time;

  float n21(vec2 p) {
    const vec3 s = vec3(7.0, 157.0, 0.0);
    vec2 h, ip = floor(p);
    p = fract(p);
    p = p * p * (3. - 2. * p);
    h = s.zy + dot(ip, s.xy);
    h = mix(fract(sin(h) * 43.5453), fract(sin(h + s.x) * 43.5453), p.x);
    return mix(h.x, h.y, p.y);
  }

  float n11(float p) {
    float ip = floor(p);
    p = fract(p);
    vec2 h = fract(sin(vec2(ip, ip + 1.) * 12.3456) * 43.5453);
    return mix(h.x, h.y, p * p * (3. - 2. * p));
  }

  float wood(vec2 p) { p.x *= 71.; p.y *= 1.9; return n11(n21(p) * 30.); }

  vec3 woodColor(vec2 p) {
    vec3 dark  = vec3(0.0195, 0.009, 0.003);
    vec3 mid   = vec3(0.049, 0.0255, 0.008);
    vec3 light = vec3(0.0825, 0.0465, 0.015);
    vec3 col = mix(mid, dark, wood(p));
    col = mix(col, light, 0.3 * wood(p * 0.2));
    return pow(col * 1.925, vec3(0.485));
  }

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  float sIOR(int i) { return 1.4 + hash(float(i) * 7.31) * 0.35; }

  vec3 sGlowCol(vec3 absorb) { return exp(-absorb * .6); }

  vec2 iSphere(vec3 ro, vec3 rd, vec3 sc, float sr) {
    vec3 oc = ro - sc;
    float b = dot(oc, rd), c = dot(oc,oc) - sr*sr, h = b*b - c;
    if (h < 0.) return vec2(-1);
    h = sqrt(h);
    return vec2(-b-h, -b+h);
  }

  vec3 skyColor(vec3 rd) {
    return mix(vec3(.25,.40,.60), vec3(.70,.85,1.0),
               pow(clamp(rd.y,0.,1.),.5)) * .8;
  }

  vec2 floorPointToScreenPoint(vec3 ro, vec3 fp) {
    vec3 fwd = normalize(-ro);
    vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, rgt);
    vec3 toPoint = normalize(fp - ro);
    vec2 uv = vec2(
      dot(toPoint, rgt) / max(0.001, dot(toPoint, fwd)),
      dot(toPoint, up) / max(0.001, dot(toPoint, fwd))
    );

    return uv * u_resolution.y + 0.5 * u_resolution.xy;
  }

  vec2 graphAnchoredWoodPoint(vec3 ro, vec3 fp) {
    vec2 screenPoint = floorPointToScreenPoint(ro, fp);
    return (screenPoint - u_graphTranslate) / max(0.001, u_graphScale);
  }

  float raySegDist(vec3 ro, vec3 rd, vec3 pa, vec3 pb) {
    vec3 ba = pb - pa, op = pa - ro;
    float b = dot(rd, ba), e = dot(ba, ba), d = dot(rd, op), f = dot(ba, op);
    float D = e - b * b;
    float s = D < 1e-6 ? .5 : clamp((b * d - f) / D, 0., 1.);
    return length((pa + s * ba) - (ro + (d + s * b) * rd));
  }

  float segDist2(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(0.001, dot(ba, ba)), 0., 1.);
    return length(pa - ba * h);
  }

  vec3 world(vec3 ro, vec3 rd) {
    if (rd.y < 0.) {
        float t = -ro.y / rd.y;
        if (t > 0.) {
          vec3 fp = ro + rd * t;
        vec3 col = woodColor(graphAnchoredWoodPoint(ro, fp) * 0.002);

        vec3  ld      = normalize(vec3(3.0, 6.0, 2.0));
        vec2  lightXZ = normalize(ld.xz);
        float stretch = length(ld.xz) / ld.y;

        float shad = 1.;
        vec3 tableGlow = vec3(0.);
        for (int i = 0; i < 24; i++) {
          if (i >= u_nodeCount) break;

          vec3  sc = u_centers[i];
          float sr = u_nodeInfo[i].x;

          vec2 shadowCenter = sc.xz - (sc.y / ld.y) * ld.xz;

          vec2  delta = fp.xz - shadowCenter;
          float along = dot(delta, lightXZ);
          float perp  = length(delta - along * lightXZ);
          float dist = length(vec2(along / (1. + stretch * 0.25), perp)) / sr;
          shad *= smoothstep(0.9, 1.08, dist);

          float selected = u_nodeInfo[i].y;
          float glowDist = length(fp.xz - sc.xz) / max(0.001, sr);
          float diffuseGlow = selected * 0.35 * exp(-glowDist * glowDist * 0.60);
          tableGlow += vec3(1.0, 0.955, 0.82) * diffuseGlow;
        }
        return col * mix(0.24, 0.91, shad) + tableGlow;
      }
    }
    return skyColor(rd);
  }

  void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 uv = (fragCoord - .5 * u_resolution.xy) / u_resolution.y;

    vec3 ro  = vec3(0., 7.5, 3.5);
    vec3 fwd = normalize(-ro);
    vec3 rgt = normalize(cross(vec3(0.0,1.0,0.0), fwd));
    vec3 rd  = normalize(fwd + uv.x * rgt + uv.y * cross(fwd, rgt));

    vec3 ld = normalize(vec3(3.0, 6.0, 2.0));

    float bestT = 1e9;
    int   bestI = -1;
    vec3  bestSC = vec3(0.);
    float bestSR = 0.;
    float bestIOR = 1.5;
    vec3  bestAbsorb = vec3(1.);
    vec3  bestGlow = vec3(1.);
    float bestSelected = 0.;
    for (int i = 0; i < 24; i++) {
      if (i >= u_nodeCount) break;
      vec3  sc = u_centers[i];
      float sr = u_nodeInfo[i].x;
      vec2 t = iSphere(ro, rd, sc, sr);
      if (t.x > 0.001 && t.x < bestT) {
        bestT = t.x;
        bestI = i;
        bestSC = sc;
        bestSR = sr;
        bestIOR = sIOR(i);
        bestAbsorb = u_absorb[i];
        bestGlow = sGlowCol(u_absorb[i]);
        bestSelected = u_nodeInfo[i].y;
      }
    }

    vec3 col;
    if (bestI >= 0) {
      vec3  sc  = bestSC;
      float sr  = bestSR;
      float IOR = bestIOR;

      vec3 p1  = ro + rd * bestT;
      vec3 n1  = normalize(p1 - sc);
      vec3 rd2 = refract(rd, n1, 1.0 / IOR);

      vec2 t2  = iSphere(p1 + rd2 * 0.001, rd2, sc, sr);
      vec3 p2  = p1 + rd2 * (0.001 + t2.y);
      vec3 n2  = normalize(p2 - sc);
      vec3 rd3 = refract(rd2, -n2, IOR);
      if (dot(rd3, rd3) < 0.1) rd3 = reflect(rd2, -n2);

      vec3 absorption = exp(-length(p2-p1) * bestAbsorb);

      float fre = mix(0.04, 1.0, pow(1.0 - max(0., dot(-rd, n1)), 4.0));
      float spe = pow(max(0., dot(reflect(-ld, n1), -rd)), 80.0) * 2.5;
      float lit = max(0., dot(n1, ld));
      float fwdS = pow(max(0., dot(rd2, ld)), 4.0) * 1.2;
      float caustic = pow(max(0., dot(rd2, ld)), 24.0) * 6.0;
      vec3 iGlow = bestGlow * lit * (fwdS + caustic);
      float centerLight = pow(max(0., dot(-rd, n1)), 2.0);
      vec3 selectedGlow = vec3(1.0, 0.96, 0.82) * bestSelected * (0.018 + centerLight * 0.055);

      col = mix(world(p2, rd3) * absorption, world(p1, reflect(rd,n1)), fre) + spe + iGlow + selectedGlow;
    } else {
      col = world(ro, rd);
    }

    for (int i = 0; i < 72; i++) {
      if (i >= u_connectionCount) break;
      vec3 ca = u_connectionA[i], cb = u_connectionB[i], dir = normalize(cb - ca);
      vec3 pa = ca + dir * u_connectionInfo[i].x, pb = cb - dir * u_connectionInfo[i].y;
      float dist = raySegDist(ro, rd, pa, pb);
      float width = u_connectionInfo[i].z;
      float widthFactor = mix(0.45, 3.6, clamp((width - 2.2) / 10.8, 0., 1.));
      float scaledDist = dist / widthFactor;
      float g = .00042 / (scaledDist * scaledDist + .0015)
              + .00008 / (scaledDist * scaledDist + .04);
      col += u_connectionColor[i] * g;
    }

    for (int i = 0; i < 24; i++) {
      if (i >= u_nodeCount) break;
      if (u_nodeInfo[i].y < 0.5) continue;

      vec2 beadScreen = floorPointToScreenPoint(ro, u_centers[i]);
      float d = length(fragCoord - beadScreen);
      float radius = u_nodeInfo[i].x * 170.0;
      float glow = 0.010 * exp(-d * d / max(1.0, radius * radius * 0.55));
      col += vec3(1.0, 0.96, 0.82) * glow;
    }

    for (int i = 0; i < 24; i++) {
      if (i >= u_controlCount) break;

      vec2 center = u_control[i].xy;
      float size = u_control[i].w;
      vec2 p = fragCoord - center;
      float halfSize = size * 0.45;
      float horizontal = segDist2(p, vec2(-halfSize, 0.), vec2(halfSize, 0.));
      float vertical = segDist2(p, vec2(0., -halfSize), vec2(0., halfSize));
      float horizontalMask = exp(-horizontal * horizontal / 0.18);
      float verticalMask = exp(-vertical * vertical / 0.18) * step(0.5, u_control[i].z);
      float beamMask = max(horizontalMask, verticalMask);
      float glowMask = max(
        exp(-horizontal * horizontal / 9.0),
        exp(-vertical * vertical / 9.0) * step(0.5, u_control[i].z)
      );
      float wideGlowMask = max(
        exp(-horizontal * horizontal / 38.0),
        exp(-vertical * vertical / 38.0) * step(0.5, u_control[i].z)
      );
      float flow = 0.86 + 0.14 * sin((p.x - p.y) * 0.55 - u_time * 5.0);
      float beam = beamMask * flow;
      float glow = glowMask * 0.62 + wideGlowMask * 0.22;
      float endFade = smoothstep(size * 0.62, size * 0.42, length(p));
      col += vec3(1.0, 0.98, 0.90) * beam * endFade * 1.7;
      col += vec3(0.64, 0.88, 1.0) * glow * endFade;
    }

    fragColor = vec4(pow(col * 1.4, vec3(0.9)), 1.);
  }

  void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('WebGL shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('WebGL program link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function hexToRgb(color: string) {
  const normalizedColor = color.startsWith('#') ? color.slice(1) : color;
  const numericColor = Number.parseInt(normalizedColor, 16);

  return [
    ((numericColor >> 16) & 255) / 255,
    ((numericColor >> 8) & 255) / 255,
    (numericColor & 255) / 255,
  ] as const;
}

function screenPoint(
  node: Pick<SimulationNode, 'x' | 'y'>,
  transform: SharedGraphRendererProps['transform'],
  fallback: { x: number; y: number }
) {
  return {
    x: (node.x ?? fallback.x) * transform.scale + transform.translateX,
    y: (node.y ?? fallback.y) * transform.scale + transform.translateY,
  };
}

function worldPoint(
  point: { x: number; y: number },
  transform: SharedGraphRendererProps['transform']
) {
  return {
    x: (point.x - transform.translateX) / transform.scale,
    y: (point.y - transform.translateY) / transform.scale,
  };
}

function colorToAbsorption(color: readonly [number, number, number]) {
  const maxChannel = Math.max(color[0], color[1], color[2], 0.001);

  return color.map(channel => {
    const normalizedChannel = channel / maxChannel;
    const saturatedChannel = Math.pow(normalizedChannel, 1.05);
    const transmission = 0.12 + saturatedChannel * 0.88;
    return -Math.log(Math.max(0.12, transmission)) / 0.46;
  }) as [number, number, number];
}

function resolveEdgeNode(node: string | SimulationNode, nodesById: Map<string, SimulationNode>) {
  return typeof node === 'string' ? nodesById.get(node) : node;
}

function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(height * pixelRatio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

export default function WebGlConceptGraphRenderer({
  nodes,
  interactionsDisabled = false,
  onNodeClick,
  onAddSourceNode,
  onRemoveSourceNode,
  graphData,
  dimensions,
  transform,
  frameVersion,
  positionsRef,
  simulationRef,
  fitGraphToViewport,
  setFrameVersion,
}: SharedGraphRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphDataRef = useRef<GraphData>({ nodes: [], edges: [] });
  const webGlResourcesRef = useRef<WebGlResources | null>(null);
  const transformRef = useRef(transform);
  const dragStateRef = useRef<PointerDragState | null>(null);
  const interactionsDisabledRef = useRef(interactionsDisabled);
  const onNodeClickRef = useRef(onNodeClick);

  useEffect(() => {
    interactionsDisabledRef.current = interactionsDisabled;
    onNodeClickRef.current = onNodeClick;
  }, [interactionsDisabled, onNodeClick]);

  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const activeSourceCount = nodes.filter(node => node.isActiveSource).length;

  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
    });
    if (!gl) return;
    let resources = webGlResourcesRef.current;
    if (!resources || resources.gl !== gl) {
      const backgroundProgram = createProgram(
        gl,
        BACKGROUND_VERTEX_SHADER,
        WOOD_BACKGROUND_FRAGMENT_SHADER
      );
      const backgroundPositionBuffer = gl.createBuffer();
      if (
        !backgroundProgram ||
        !backgroundPositionBuffer
      ) {
        return;
      }

      resources = {
        gl,
        backgroundProgram,
        backgroundPositionBuffer,
      };
      webGlResourcesRef.current = resources;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.06, 0.035, 0.014, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(resources.backgroundProgram);
    const backgroundPositionLocation = gl.getAttribLocation(resources.backgroundProgram, 'a_position');
    const backgroundResolutionLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_resolution');
    const graphTranslateLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_graphTranslate');
    const graphScaleLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_graphScale');
    const nodeCountLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_nodeCount');
    const centersLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_centers[0]');
    const absorbLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_absorb[0]');
    const nodeInfoLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_nodeInfo[0]');
    const connectionCountLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_connectionCount');
    const connectionALocation = gl.getUniformLocation(resources.backgroundProgram, 'u_connectionA[0]');
    const connectionBLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_connectionB[0]');
    const connectionColorLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_connectionColor[0]');
    const connectionInfoLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_connectionInfo[0]');
    const controlCountLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_controlCount');
    const controlLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_control[0]');
    const timeLocation = gl.getUniformLocation(resources.backgroundProgram, 'u_time');
    const shaderNodeCount = Math.min(graphDataRef.current.nodes.length, MAX_SHADER_BEADS);
    const shaderCenters = new Float32Array(MAX_SHADER_BEADS * 3);
    const shaderAbsorb = new Float32Array(MAX_SHADER_BEADS * 3);
    const shaderNodeInfo = new Float32Array(MAX_SHADER_BEADS * 2);
    const shaderConnectionA = new Float32Array(MAX_SHADER_CONNECTIONS * 3);
    const shaderConnectionB = new Float32Array(MAX_SHADER_CONNECTIONS * 3);
    const shaderConnectionColor = new Float32Array(MAX_SHADER_CONNECTIONS * 3);
    const shaderConnectionInfo = new Float32Array(MAX_SHADER_CONNECTIONS * 3);
    const shaderControl = new Float32Array(MAX_SHADER_CONTROLS * 4);
    const shaderNodeDataById = new Map<string, {
      center: [number, number, number];
      radius: number;
    }>();
    const shaderFallback = {
      x: dimensions.width / 2,
      y: dimensions.height / 2,
    };
    const pixelRatio = canvas.width / dimensions.width || 1;

    graphDataRef.current.nodes.slice(0, MAX_SHADER_BEADS).forEach((node, index) => {
      const point = screenPoint(node, transformRef.current, shaderFallback);
      const floorPoint = shaderFloorPointForScreenPoint(point, dimensions.width, dimensions.height);
      const radius = getGraphNodeBeadRadius(node);
      const color = hexToRgb(node.beadColor);
      const absorption = colorToAbsorption(color);

      shaderCenters[index * 3] = floorPoint.x;
      shaderCenters[index * 3 + 1] = radius;
      shaderCenters[index * 3 + 2] = floorPoint.z;
      shaderAbsorb[index * 3] = absorption[0];
      shaderAbsorb[index * 3 + 1] = absorption[1];
      shaderAbsorb[index * 3 + 2] = absorption[2];
      shaderNodeInfo[index * 2] = radius;
      shaderNodeInfo[index * 2 + 1] = node.isActiveSource ? 1 : 0;
      shaderNodeDataById.set(node.id, {
        center: [floorPoint.x, radius, floorPoint.z],
        radius,
      });
    });

    const nodesById = new Map(graphDataRef.current.nodes.map(node => [node.id, node]));
    let shaderConnectionCount = 0;
    graphDataRef.current.edges.slice(0, MAX_SHADER_CONNECTIONS).forEach(edge => {
      const source = resolveEdgeNode(edge.source, nodesById);
      const target = resolveEdgeNode(edge.target, nodesById);
      if (!source || !target) return;

      const sourceData = shaderNodeDataById.get(source.id);
      const targetData = shaderNodeDataById.get(target.id);
      if (!sourceData || !targetData) return;

      const connectionIndex = shaderConnectionCount;
      const color = hexToRgb(edge.color);
      shaderConnectionA.set(sourceData.center, connectionIndex * 3);
      shaderConnectionB.set(targetData.center, connectionIndex * 3);
      shaderConnectionColor[connectionIndex * 3] = Math.min(1, color[0] * 1.5 + 0.12);
      shaderConnectionColor[connectionIndex * 3 + 1] = Math.min(1, color[1] * 1.5 + 0.12);
      shaderConnectionColor[connectionIndex * 3 + 2] = Math.min(1, color[2] * 1.5 + 0.12);
      shaderConnectionInfo[connectionIndex * 3] = sourceData.radius;
      shaderConnectionInfo[connectionIndex * 3 + 1] = targetData.radius;
      shaderConnectionInfo[connectionIndex * 3 + 2] = getGraphEdgeStrokeWidth(edge);
      shaderConnectionCount += 1;
    });

    let shaderControlCount = 0;
    if (!interactionsDisabled) {
      graphDataRef.current.nodes.slice(0, MAX_SHADER_BEADS).forEach(node => {
        if (shaderControlCount >= MAX_SHADER_CONTROLS) return;

        const canRemove = node.isActiveSource && activeSourceCount > 1;
        const canAdd = !node.isActiveSource;
        if (!canAdd && !canRemove) return;

        const point = screenPoint(node, transformRef.current, shaderFallback);
        const visualRadius = projectedBeadScreenRadius(node, point, dimensions.width, dimensions.height);
        const floorPoint = shaderFloorPointForScreenPoint(point, dimensions.width, dimensions.height);
        const beadRadius = getGraphNodeBeadRadius(node);
        const beadCenter = shaderScreenPointForWorldPoint(
          { x: floorPoint.x, y: beadRadius, z: floorPoint.z },
          dimensions.width,
          dimensions.height
        );
        const controlX = beadCenter.x + visualRadius * CONTROL_RADIAL_FACTOR * NORTHEAST_DIAGONAL;
        const controlY = beadCenter.y - visualRadius * CONTROL_RADIAL_FACTOR * NORTHEAST_DIAGONAL;

        shaderControl[shaderControlCount * 4] = controlX * pixelRatio;
        shaderControl[shaderControlCount * 4 + 1] = canvas.height - controlY * pixelRatio;
        shaderControl[shaderControlCount * 4 + 2] = canRemove ? -1 : 1;
        shaderControl[shaderControlCount * 4 + 3] = CONTROL_GLYPH_SIZE * pixelRatio;
        shaderControlCount += 1;
      });
    }

    const graphTransform = transformRef.current;

    gl.uniform2f(backgroundResolutionLocation, canvas.width, canvas.height);
    gl.uniform2f(
      graphTranslateLocation,
      graphTransform.translateX * pixelRatio,
      graphTransform.translateY * pixelRatio
    );
    gl.uniform1f(graphScaleLocation, graphTransform.scale * pixelRatio);
    gl.uniform1i(nodeCountLocation, shaderNodeCount);
    gl.uniform3fv(centersLocation, shaderCenters);
    gl.uniform3fv(absorbLocation, shaderAbsorb);
    gl.uniform2fv(nodeInfoLocation, shaderNodeInfo);
    gl.uniform1i(connectionCountLocation, shaderConnectionCount);
    gl.uniform3fv(connectionALocation, shaderConnectionA);
    gl.uniform3fv(connectionBLocation, shaderConnectionB);
    gl.uniform3fv(connectionColorLocation, shaderConnectionColor);
    gl.uniform3fv(connectionInfoLocation, shaderConnectionInfo);
    gl.uniform1i(controlCountLocation, shaderControlCount);
    gl.uniform4fv(controlLocation, shaderControl);
    gl.uniform1f(timeLocation, performance.now() / 1000);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.backgroundPositionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
      ]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(backgroundPositionLocation);
    gl.vertexAttribPointer(backgroundPositionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

  }, [activeSourceCount, dimensions.height, dimensions.width, interactionsDisabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setCanvasSize(canvas, dimensions.width, dimensions.height);
    drawGraph();
  }, [dimensions.height, dimensions.width, drawGraph]);

  useEffect(() => {
    drawGraph();
  }, [drawGraph, frameVersion, graphData, transform]);

  useEffect(() => {
    return () => {
      const resources = webGlResourcesRef.current;
      if (resources) {
        resources.gl.deleteBuffer(resources.backgroundPositionBuffer);
        resources.gl.deleteProgram(resources.backgroundProgram);
        webGlResourcesRef.current = null;
      }
    };
  }, []);

  const findNodeAtScreenPoint = useCallback((point: { x: number; y: number }) => {
    const fallback = {
      x: dimensions.width / 2,
      y: dimensions.height / 2,
    };
    const transform = transformRef.current;
    const orderedNodes = [...graphDataRef.current.nodes].reverse();

    return orderedNodes.find(node => {
      const nodePoint = screenPoint(node, transform, fallback);
      const visualRadius = projectedBeadScreenRadius(
        node,
        nodePoint,
        dimensions.width,
        dimensions.height
      );
      const hitRadius = Math.max(14, visualRadius + 8);
      return Math.hypot(point.x - nodePoint.x, point.y - nodePoint.y) <= hitRadius;
    });
  }, [dimensions.height, dimensions.width]);

  const getPointerPoint = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();

    return {
      x: event.clientX - (rect?.left || 0),
      y: event.clientY - (rect?.top || 0),
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getPointerPoint(event);
    const node = findNodeAtScreenPoint(point);
    if (!node) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      nodeId: node.id,
      startX: point.x,
      startY: point.y,
      didDrag: false,
    };

    node.fx = node.x ?? dimensions.width / 2;
    node.fy = node.y ?? dimensions.height / 2;
    simulationRef.current?.alphaTarget(INTERACTION_ALPHA_TARGET).restart();
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getPointerPoint(event);
    const dragState = dragStateRef.current;

    if (!dragState) {
      event.currentTarget.style.cursor = findNodeAtScreenPoint(point) ? 'grab' : 'default';
      return;
    }

    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    if (Math.hypot(deltaX, deltaY) > 3) {
      dragState.didDrag = true;
    }

    const node = graphDataRef.current.nodes.find(item => item.id === dragState.nodeId);
    if (!node) return;

    const world = worldPoint(point, transformRef.current);
    node.fx = world.x;
    node.fy = world.y;
    positionsRef.current.set(node.id, world);
    drawGraph();
    setFrameVersion(version => version + 1);
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    event.currentTarget.releasePointerCapture(dragState.pointerId);
    dragStateRef.current = null;

    const node = graphDataRef.current.nodes.find(item => item.id === dragState.nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
      simulationRef.current?.alphaTarget(BACKGROUND_ALPHA_TARGET).restart();

      if (!dragState.didDrag && !interactionsDisabledRef.current) {
        onNodeClickRef.current(node.id);
      } else {
        window.setTimeout(() => fitGraphToViewport(450), 80);
      }
    }
  };

  const overlayNodes = useMemo(() => {
    void frameVersion;
    const fallback = {
      x: dimensions.width / 2,
      y: dimensions.height / 2,
    };

    return graphData.nodes.map(node => {
      const point = screenPoint(node, transform, fallback);
      const floorPoint = shaderFloorPointForScreenPoint(point, dimensions.width, dimensions.height);
      const beadRadius = getGraphNodeBeadRadius(node);
      const beadCenter = shaderScreenPointForWorldPoint(
        { x: floorPoint.x, y: beadRadius, z: floorPoint.z },
        dimensions.width,
        dimensions.height
      );

      return {
        node,
        point,
        beadCenter,
        visualRadius: projectedBeadScreenRadius(node, point, dimensions.width, dimensions.height),
      };
    });
  }, [dimensions.height, dimensions.width, frameVersion, graphData.nodes, transform]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="pointer-events-none absolute inset-0">
        {overlayNodes.map(({ node, beadCenter, visualRadius }) => (
          <div
            key={node.id}
            className="gbg-small-caps absolute text-center font-serif font-medium text-gray-900"
            style={{
              left: beadCenter.x,
              top: beadCenter.y + visualRadius + GRAPH_LABEL_GAP,
              transform: 'translateX(-50%)',
              fontSize: GRAPH_LABEL_FONT_SIZE,
              lineHeight: 1.1,
              textShadow: '0 0 4px white, 0 0 4px white',
            }}
          >
            {node.label}
          </div>
        ))}
      </div>
      {!interactionsDisabled && (
        <div className="pointer-events-none absolute inset-0">
          {overlayNodes.map(({ node, beadCenter, visualRadius }) => {
            const canRemove = node.isActiveSource && activeSourceCount > 1;
            const canAdd = !node.isActiveSource;
            if (!canAdd && !canRemove) return null;

            return (
              <button
                key={node.id}
                type="button"
                aria-label={canRemove ? `Remove ${node.label} from selected topics` : `Add ${node.label} to selected topics`}
                className="pointer-events-auto absolute h-9 w-9 bg-transparent opacity-0"
                style={{
                  left: beadCenter.x + visualRadius * CONTROL_RADIAL_FACTOR * NORTHEAST_DIAGONAL,
                  top: beadCenter.y - visualRadius * CONTROL_RADIAL_FACTOR * NORTHEAST_DIAGONAL,
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={() => {
                  if (canRemove) {
                    onRemoveSourceNode(node.id);
                  } else {
                    onAddSourceNode(node.id);
                  }
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
