import { getGraphNodeBeadRadius } from '@/domain/graphLayout';
import type { SimulationNode } from './graphRendererTypes';

export function shaderFloorPointForScreenPoint(
  point: { x: number; y: number },
  width: number,
  height: number
) {
  const uv = {
    x: (point.x - 0.5 * width) / height,
    y: (height - point.y - 0.5 * height) / height,
  };
  const ro = { x: 0, y: 7.5, z: 3.5 };
  const fwd = normalize3({ x: -ro.x, y: -ro.y, z: -ro.z });
  const rgt = normalize3(cross3({ x: 0, y: 1, z: 0 }, fwd));
  const up = cross3(fwd, rgt);
  const rd = normalize3({
    x: fwd.x + uv.x * rgt.x + uv.y * up.x,
    y: fwd.y + uv.x * rgt.y + uv.y * up.y,
    z: fwd.z + uv.x * rgt.z + uv.y * up.z,
  });
  const t = -ro.y / rd.y;

  return {
    x: ro.x + rd.x * t,
    z: ro.z + rd.z * t,
  };
}

export function projectedBeadScreenRadius(
  node: SimulationNode,
  point: { x: number; y: number },
  width: number,
  height: number
) {
  const beadRadius = getGraphNodeBeadRadius(node);
  const floorPoint = shaderFloorPointForScreenPoint(point, width, height);
  const center = shaderScreenPointForWorldPoint(
    { x: floorPoint.x, y: beadRadius, z: floorPoint.z },
    width,
    height
  );
  const edge = shaderScreenPointForWorldPoint(
    { x: floorPoint.x + beadRadius, y: beadRadius, z: floorPoint.z },
    width,
    height
  );

  return Math.max(node.radius, Math.hypot(edge.x - center.x, edge.y - center.y));
}

function shaderScreenPointForWorldPoint(
  point: { x: number; y: number; z: number },
  width: number,
  height: number
) {
  const ro = { x: 0, y: 7.5, z: 3.5 };
  const fwd = normalize3({ x: -ro.x, y: -ro.y, z: -ro.z });
  const rgt = normalize3(cross3({ x: 0, y: 1, z: 0 }, fwd));
  const up = cross3(fwd, rgt);
  const toPoint = normalize3({
    x: point.x - ro.x,
    y: point.y - ro.y,
    z: point.z - ro.z,
  });
  const forwardDepth = Math.max(0.001, dot3(toPoint, fwd));
  const uv = {
    x: dot3(toPoint, rgt) / forwardDepth,
    y: dot3(toPoint, up) / forwardDepth,
  };

  return {
    x: uv.x * height + 0.5 * width,
    y: height - (uv.y * height + 0.5 * height),
  };
}

function normalize3(vector: { x: number; y: number; z: number }) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function dot3(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross3(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number }
) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}
