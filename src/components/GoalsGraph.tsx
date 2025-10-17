import { ForwardedRef, MouseEvent, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { LifeGoalLink, LifeGoalNode } from '../types';

interface GoalsGraphProps {
  nodes: LifeGoalNode[];
  links: LifeGoalLink[];
  onSelectGoal: (id: string) => void;
  width: number;
  height: number;
  isRoot: (id: string) => boolean;
  gravity: number;
  onShare: (canvas: HTMLCanvasElement) => void;
  onNodePositionChange?: (id: string, position: { x: number; y: number }) => void;
  onNodeDoubleClick?: (id: string) => void;
}

export interface GoalsGraphHandle {
  share: () => void;
}

interface SimNode extends LifeGoalNode {
  vx: number;
  vy: number;
  dragging?: boolean;
}

type NodeMap = Record<string, SimNode>;

const ROOT_RADIUS = 12;
const NODE_RADIUS = 5;
const SPRING_LENGTH = 110;
const SPRING_STRENGTH = 0.035;
const REPULSION = 32000;
const DAMPING = 0.9;

function GoalsGraphInternal({
  nodes,
  links,
  onSelectGoal,
  width,
  height,
  isRoot,
  gravity,
  onShare,
  onNodePositionChange,
  onNodeDoubleClick
}: GoalsGraphProps, ref: ForwardedRef<GoalsGraphHandle>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [positions, setPositions] = useState<NodeMap>(() => initialise(nodes));
  const animationRef = useRef<number | null>(null);
  const clickRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  useEffect(() => {
    setPositions((prev) => {
      const next: NodeMap = { ...prev };
      nodes.forEach((node, index) => {
        if (!next[node.id]) {
          const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
          const radius = 200;
          next[node.id] = {
            ...node,
            x: width / 2 + Math.cos(angle) * radius,
            y: height / 2 + Math.sin(angle) * radius,
            vx: 0,
            vy: 0
          };
        }
      });
      Object.keys(next).forEach((id) => {
        if (!nodes.find((node) => node.id === id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [nodes, width, height]);

  useEffect(() => {
    const step = () => {
      setPositions((prev) => simulate(prev, links, width, height, isRoot, gravity, draggingIdRef.current));
      draw();
      animationRef.current = requestAnimationFrame(step);
    };
    animationRef.current = requestAnimationFrame(step);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, links, width, height, isRoot, gravity]);

  useEffect(() => {
    draw();
  }, [positions, links]);

  useImperativeHandle(
    ref,
    () => ({
      share: () => {
        if (!canvasRef.current) {
          return;
        }
        draw();
        onShare(canvasRef.current);
      }
    }),
    [onShare]
  );

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    const style = getComputedStyle(document.documentElement);
    const background = style.getPropertyValue('--surface-panel-strong') || '#020617';
    const linkColor = style.getPropertyValue('--accent-500') || '#38bdf8';
    const rootFill = style.getPropertyValue('--accent-500') || '#38bdf8';
    const rootStroke = style.getPropertyValue('--accent-400') || '#2dd4bf';
    const nodeFill = style.getPropertyValue('--surface-chip') || '#94a3b866';
    const nodeStroke = style.getPropertyValue('--surface-border') || '#334155';
    const textColor = style.getPropertyValue('--surface-text-primary') || '#e2e8f0';

    context.fillStyle = background.trim() || '#020617';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = `${linkColor.trim() || '#38bdf8'}55`;
    context.lineWidth = 1.5;
    links.forEach((link) => {
      const source = positions[link.sourceId];
      const target = positions[link.targetId];
      if (!source || !target) {
        return;
      }
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
      context.stroke();
    });

    Object.values(positions).forEach((node) => {
      const radius = isRoot(node.id) ? ROOT_RADIUS : NODE_RADIUS;
      context.beginPath();
      context.fillStyle = isRoot(node.id)
        ? rootFill.trim() || '#38bdf8'
        : (nodeFill.trim() || '#94a3b866');
      context.strokeStyle = isRoot(node.id)
        ? rootStroke.trim() || '#38bdf8'
        : (nodeStroke.trim() || '#334155');
      context.lineWidth = isRoot(node.id) ? 2.5 : 1.2;
      context.arc(node.x, node.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = textColor.trim() || '#e2e8f0';
      context.font = isRoot(node.id) ? '700 15px Inter, sans-serif' : '600 12px Inter, sans-serif';
      context.textAlign = 'left';
      context.textBaseline = 'middle';
      context.fillText(node.title, node.x + radius + 8, node.y);
    });
  };

  const handlePointerDown = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const target = findNodeAt(positions, x, y, isRoot);
    clickRef.current = target ? { id: target.id, x, y } : null;
    if (target && !isRoot(target.id)) {
      dragRef.current = {
        id: target.id,
        offsetX: x - target.x,
        offsetY: y - target.y,
        moved: false
      };
      draggingIdRef.current = target.id;
      setPositions((prev) => {
        const current = prev[target.id];
        if (!current) {
          return prev;
        }
        return {
          ...prev,
          [target.id]: {
            ...current,
            dragging: true,
            vx: 0,
            vy: 0
          }
        };
      });
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = 'grabbing';
      }
    }
  };

  const handlePointerMove = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const drag = dragRef.current;
    if (drag) {
      setPositions((prev) => {
        const node = prev[drag.id];
        if (!node) {
          return prev;
        }
        const next: NodeMap = { ...prev, [drag.id]: { ...node, x: x - drag.offsetX, y: y - drag.offsetY, vx: 0, vy: 0, dragging: true } };
        drag.moved = true;
        return next;
      });
      return;
    }
    const target = findNodeAt(positions, x, y, isRoot);
    canvas.style.cursor = target ? 'grab' : 'default';
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    const click = clickRef.current;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
    if (drag?.moved) {
      const node = positions[drag.id];
      if (node && onNodePositionChange) {
        onNodePositionChange(drag.id, { x: node.x, y: node.y });
      }
    } else if (click) {
      const node = findNodeAt(positions, click.x, click.y, isRoot);
      if (node) {
        onSelectGoal(node.id);
      }
    }
    if (drag) {
      setPositions((prev) => {
        const node = prev[drag.id];
        if (!node) {
          return prev;
        }
        return {
          ...prev,
          [drag.id]: { ...node, dragging: false }
        };
      });
    }
    draggingIdRef.current = null;
    dragRef.current = null;
    clickRef.current = null;
  };

  const handlePointerLeave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
    const drag = dragRef.current;
    if (drag) {
      setPositions((prev) => {
        const node = prev[drag.id];
        if (!node) {
          return prev;
        }
        return {
          ...prev,
          [drag.id]: { ...node, dragging: false }
        };
      });
    }
    dragRef.current = null;
    draggingIdRef.current = null;
  };

  const handleDoubleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const node = findNodeAt(positions, x, y, isRoot);
    if (node) {
      if (onNodeDoubleClick) {
        onNodeDoubleClick(node.id);
      } else {
        onSelectGoal(node.id);
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full select-none rounded-2xl border border-slate-800 bg-slate-950"
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerLeave}
      onDoubleClick={handleDoubleClick}
    />
  );
}

export const GoalsGraph = forwardRef<GoalsGraphHandle, GoalsGraphProps>(GoalsGraphInternal);

function initialise(nodes: LifeGoalNode[]): NodeMap {
  const map: NodeMap = {};
  nodes.forEach((node, index) => {
    const legacyPosition = (node as unknown as { position?: { x?: number; y?: number } }).position;
    const initialX = typeof node.x === 'number' ? node.x : legacyPosition?.x;
    const initialY = typeof node.y === 'number' ? node.y : legacyPosition?.y;
    map[node.id] = {
      ...node,
      x: initialX ?? 200 + Math.cos(index) * 60,
      y: initialY ?? 200 + Math.sin(index) * 60,
      vx: 0,
      vy: 0,
      dragging: false
    };
  });
  return map;
}

function simulate(
  prev: NodeMap,
  links: LifeGoalLink[],
  width: number,
  height: number,
  isRoot: (id: string) => boolean,
  gravity: number,
  draggingId: string | null
): NodeMap {
  const next: NodeMap = {};
  const entries = Object.values(prev);
  if (entries.length === 0) {
    return prev;
  }

  entries.forEach((node) => {
    next[node.id] = { ...node };
  });

  for (let i = 0; i < entries.length; i += 1) {
    const nodeA = next[entries[i].id];
    const { x: ax, y: ay } = nodeA;
    for (let j = i + 1; j < entries.length; j += 1) {
      const nodeB = next[entries[j].id];
      const dx = ax - nodeB.x;
      const dy = ay - nodeB.y;
      const distSq = dx * dx + dy * dy + 0.01;
      const force = REPULSION / distSq;
      const distance = Math.sqrt(distSq);
      const fx = (force * dx) / distance;
      const fy = (force * dy) / distance;
      if (!isRoot(nodeA.id) && nodeA.id !== draggingId && !nodeA.dragging) {
        nodeA.vx += fx;
        nodeA.vy += fy;
      }
      if (!isRoot(nodeB.id) && nodeB.id !== draggingId && !nodeB.dragging) {
        nodeB.vx -= fx;
        nodeB.vy -= fy;
      }
    }
  }

  links.forEach((link) => {
    const source = next[link.sourceId];
    const target = next[link.targetId];
    if (!source || !target) {
      return;
    }
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const force = (distance - SPRING_LENGTH) * SPRING_STRENGTH;
    const fx = (force * dx) / distance;
    const fy = (force * dy) / distance;
    if (!isRoot(source.id) && source.id !== draggingId && !source.dragging) {
      source.vx += fx;
      source.vy += fy;
    }
    if (!isRoot(target.id) && target.id !== draggingId && !target.dragging) {
      target.vx -= fx;
      target.vy -= fy;
    }
  });

  const centerX = width / 2;
  const centerY = height / 2;
  const clampMargin = 40;

  Object.values(next).forEach((node) => {
    if (isRoot(node.id)) {
      node.vx = 0;
      node.vy = 0;
      node.x = centerX;
      node.y = centerY;
      return;
    }
    if (node.id !== draggingId && !node.dragging) {
      node.vx += (centerX - node.x) * gravity;
      node.vy += (centerY - node.y) * gravity;
      node.vx *= DAMPING;
      node.vy *= DAMPING;
      node.x += node.vx;
      node.y += node.vy;
    }
    node.x = Math.max(clampMargin, Math.min(width - clampMargin, node.x));
    node.y = Math.max(clampMargin, Math.min(height - clampMargin, node.y));
  });

  return next;
}

function findNodeAt(map: NodeMap, x: number, y: number, isRoot: (id: string) => boolean) {
  return Object.values(map).find((node) => {
    const radius = isRoot(node.id) ? ROOT_RADIUS : NODE_RADIUS * 1.5;
    const dx = x - node.x;
    const dy = y - node.y;
    return dx * dx + dy * dy <= radius * radius;
  });
}
