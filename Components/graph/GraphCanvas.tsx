import { useRef, useEffect, useState, type MouseEvent, type WheelEvent } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Person, Connection } from '@/Entities/all';
import { categorizeNodes, LayoutPerson, CORE_THRESHOLD } from '@/services/layoutUtils';

const LABEL_VISIBILITY_ZOOM_THRESHOLD = 1.5;
// Zoom level where the graph switches between macro and micro rendering
const LOD_TRANSITION_ZOOM_THRESHOLD = 1.2;

interface GraphCanvasProps {
  nodes: Person[];
  connections: Connection[];
  highlightedNodes?: string[];
  highlightedConnections?: string[];
  onNodeClick?: (nodeId: string) => void;
  onGraphAction?: (action: any) => void;
}

export default function GraphCanvas({ 
  nodes = [], 
  connections = [], 
  highlightedNodes = [], 
  highlightedConnections = [],
  onNodeClick,
  onGraphAction 
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const brokenImageCache = useRef(new Set<string>());
  const [imagesLoaded, setImagesLoaded] = useState(0);

  const connectionColors: { [key: string]: string } = {
    WORK: '#FFC107',
    STUDY: '#F44336',
  };

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const starfield = useRef<{ x: number; y: number; size: number; alpha: number }[]>([]);

  const [positionedNodes, setPositionedNodes] = useState<LayoutPerson[]>([]);

  // Recalculate node layout whenever data or canvas size changes
  useEffect(() => {
    const categorized = categorizeNodes(nodes, connections, CORE_THRESHOLD);
    const coreNodes = categorized.filter(n => n.layoutType === 'core');
    const satelliteNodes = categorized.filter(n => n.layoutType === 'satellite');

    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    // Spread satellites based on available canvas size. Push them near the edges
    // of the canvas to emphasize empty space between core and periphery.
    const radius = Math.min(canvasSize.width, canvasSize.height) * 0.45;

    satelliteNodes.forEach((node, idx) => {
      const angle = (2 * Math.PI / satelliteNodes.length) * idx;
      node.node_position = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    coreNodes.forEach(node => {
      node.node_position = node.node_position || {
        // Keep the core tightly clustered in the middle
        x: centerX + (Math.random() - 0.5) * 80,
        y: centerY + (Math.random() - 0.5) * 80
      };
    });

    setPositionedNodes([...coreNodes, ...satelliteNodes]);
  }, [nodes, connections, canvasSize]);

  // Observe canvas size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    canvas.parentElement && observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  // Generate starfield whenever canvas size changes
  useEffect(() => {
    const stars = [] as { x: number; y: number; size: number; alpha: number }[];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * canvasSize.width,
        y: Math.random() * canvasSize.height,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2
      });
    }
    starfield.current = stars;
  }, [canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationFrameId: number;
    
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      ctx.scale(dpr, dpr);
    };

    const getImage = (url: string) => {
      if (brokenImageCache.current.has(url)) return null;
      if (imageCache.current.has(url)) return imageCache.current.get(url)!;

      const img = new Image();
      img.src = url;
      img.onload = () => setImagesLoaded(v => v + 1);
      img.onerror = () => brokenImageCache.current.add(url);
      imageCache.current.set(url, img);
      return img;
    };

    const drawMacroView = () => {
      connections.forEach(connection => {
        const nodeA = positionedNodes.find(n => n.id === connection.person_a_id);
        const nodeB = positionedNodes.find(n => n.id === connection.person_b_id);
        if (nodeA && nodeB && nodeA.node_position && nodeB.node_position) {
          const isHighlighted = highlightedConnections.includes(connection.id);
          const connType = (connection as any).type || (connection as any).connection_type;
          const color = isHighlighted ? '#3B82F6' : (connectionColors[connType] || '#475569');
          ctx.strokeStyle = color;
          ctx.lineWidth = isHighlighted ? 4 : 3;
          ctx.globalAlpha = isHighlighted ? 1 : 0.8;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(nodeA.node_position.x, nodeA.node_position.y);
          ctx.lineTo(nodeB.node_position.x, nodeB.node_position.y);
          ctx.stroke();
        }
      });

      positionedNodes.forEach(node => {
        if (!node.node_position) return;
        const { x, y } = node.node_position;
        const isHighlighted = highlightedNodes.includes(node.id);
        if (node.layoutType === 'satellite') {
          const name = node.name || '';
          const initials = name
            .split(/\s+/)
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          ctx.fillStyle = '#F8FAFC';
          const fontSize = isHighlighted ? 14 : 12;
          ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(initials, x, y);
        } else {
          const radius = isHighlighted ? 5 : 3;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = isHighlighted ? '#60A5FA' : '#FFFFFF';
          ctx.fill();
        }
      });
    };

    const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
      return !(b.x > a.x + a.width || b.x + b.width < a.x || b.y > a.y + a.height || b.y + b.height < a.y);
    };

    const drawMicroView = (drawnLabelBounds: { x: number; y: number; width: number; height: number }[]) => {
      connections.forEach(connection => {
        const nodeA = positionedNodes.find(n => n.id === connection.person_a_id);
        const nodeB = positionedNodes.find(n => n.id === connection.person_b_id);
        if (nodeA && nodeB && nodeA.node_position && nodeB.node_position) {
          const isHighlighted = highlightedConnections.includes(connection.id);
          const x1 = nodeA.node_position.x;
          const y1 = nodeA.node_position.y;
          const x2 = nodeB.node_position.x;
          const y2 = nodeB.node_position.y;

          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const curvature = Math.min(distance * 0.3, 80);
          const perpX = -dy / distance * curvature;
          const perpY = dx / distance * curvature;
          const controlX = midX + perpX;
          const controlY = midY + perpY;

          const connType = (connection as any).type || (connection as any).connection_type;
          const color = isHighlighted ? '#3B82F6' : (connectionColors[connType] || '#475569');
          ctx.strokeStyle = color;
          ctx.lineWidth = isHighlighted ? 3 : 1.5;
          ctx.globalAlpha = isHighlighted ? 1 : 0.9;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(controlX, controlY, x2, y2);
          ctx.stroke();

          if (isHighlighted && connType) {
            ctx.fillStyle = '#F8FAFC';
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(connType.replace('_', ' '), controlX, controlY - 5);
          }
        }
      });

      positionedNodes.forEach(node => {
        if (!node.node_position) return;
        const { x, y } = node.node_position;
        const isHighlighted = highlightedNodes.includes(node.id);
        const radius = isHighlighted ? 14 : 12;

        const img = getImage(node.profile_picture_url || node.avatar || '');
        if (img && img.complete && !brokenImageCache.current.has(img.src)) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = '#334155';
          ctx.fill();
        }

        const fontSize = 12;
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = '#F8FAFC';
        const metrics = ctx.measureText(node.name);
        const box = { x: x + radius + 4, y: y - fontSize / 2, width: metrics.width, height: fontSize };
        if (!drawnLabelBounds.some(b => overlaps(b, box))) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.name, x + radius + 4, y);
          drawnLabelBounds.push(box);
        }
      });
    };

    const draw = () => {
      resizeCanvas();

      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, rect.width, rect.height);

      starfield.current.forEach(star => {
        ctx.beginPath();
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.arc(star.x, star.y, star.size, 0, 2 * Math.PI);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      const drawnLabelBounds: { x: number; y: number; width: number; height: number }[] = [];

      if (zoom < LOD_TRANSITION_ZOOM_THRESHOLD) {
        drawMacroView();
      } else {
        drawMicroView(drawnLabelBounds);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(draw);
    };
    
    draw();

    const resizeObserver = new ResizeObserver(() => {
        // No need to call draw here, it's called by the animation frame
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [positionedNodes, connections, highlightedNodes, highlightedConnections, zoom, offset, imagesLoaded]);

  const handleMouseDown = (e: MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;
    
    // Check if clicking on a node
    const clickedNode = positionedNodes.find(node => {
      if (!node.node_position) return false;
      const dx = x - node.node_position.x;
      const dy = y - node.node_position.y;
      return Math.sqrt(dx * dx + dy * dy) <= 15;
    });
    
    if (clickedNode && onNodeClick) {
      onNodeClick(clickedNode.id);
      return;
    }
    
    // Start dragging
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const newZoom = Math.max(0.1, Math.min(3, zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
    setZoom(newZoom);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [zoom]);

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom(Math.min(3, zoom + 0.2))}
          className="w-10 h-10 rounded-xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-slate-300 hover:text-white"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom(Math.max(0.1, zoom - 0.2))}
          className="w-10 h-10 rounded-xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-slate-300 hover:text-white"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={resetView}
          className="w-10 h-10 rounded-xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-slate-300 hover:text-white"
        >
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* Graph Stats */}
      <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 px-4 py-2">
        <div className="text-sm text-slate-300">
          <span className="text-blue-400 font-medium">{positionedNodes.length}</span> nodes • 
          <span className="text-indigo-400 font-medium ml-1">{connections.length}</span> connections
        </div>
      </div>

      {/* Loading State */}
      {positionedNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading network graph...</p>
          </div>
        </div>
      )}
    </div>
  );
}
