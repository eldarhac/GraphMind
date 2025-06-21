import { useRef, useEffect, useState, type MouseEvent, type WheelEvent } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Person, Connection } from '@/Entities/all';
import { categorizeNodes, LayoutPerson, CORE_THRESHOLD } from '@/services/layoutUtils';

const LABEL_VISIBILITY_ZOOM_THRESHOLD = 1.5;

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
    // Spread satellites based on available canvas size
    const radius = Math.min(centerX, centerY) * 0.9;

    satelliteNodes.forEach((node, idx) => {
      const angle = (2 * Math.PI / satelliteNodes.length) * idx;
      node.node_position = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    coreNodes.forEach(node => {
      node.node_position = node.node_position || {
        x: centerX + (Math.random() - 0.5) * 120,
        y: centerY + (Math.random() - 0.5) * 120
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

    const draw = () => {
      resizeCanvas();
      
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();

      // Clear canvas with a background color
      ctx.fillStyle = '#0F172A'; // slate-900
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Starfield background
      starfield.current.forEach(star => {
        ctx.beginPath();
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = '#FFFFFF';
        ctx.arc(star.x, star.y, star.size, 0, 2 * Math.PI);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      
      // Apply transformations
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);

      // Track label bounds to avoid overlapping labels
      const drawnLabelBounds: { x: number; y: number; width: number; height: number }[] = [];

      // Draw connections first (so they appear behind nodes)
      connections.forEach(connection => {
        const nodeA = positionedNodes.find(n => n.id === connection.person_a_id);
        const nodeB = positionedNodes.find(n => n.id === connection.person_b_id);
        
        if (nodeA && nodeB && nodeA.node_position && nodeB.node_position) {
          const isHighlighted = highlightedConnections.includes(connection.id);
          
          const x1 = nodeA.node_position.x;
          const y1 = nodeA.node_position.y;
          const x2 = nodeB.node_position.x;
          const y2 = nodeB.node_position.y;
          
          // Calculate curve control point
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Create perpendicular offset for curve
          const curvature = Math.min(distance * 0.3, 80);
          const perpX = -dy / distance * curvature;
          const perpY = dx / distance * curvature;
          
          const controlX = midX + perpX;
          const controlY = midY + perpY;

          // Draw curved connection
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(controlX, controlY, x2, y2);
          
          const connType = (connection as any).type || (connection as any).connection_type;
          ctx.strokeStyle = isHighlighted ? '#3B82F6' : (connectionColors[connType] || '#475569');
          ctx.lineWidth = isHighlighted ? 4 : 2;
          ctx.globalAlpha = isHighlighted ? 1 : 0.8;
          ctx.lineCap = 'round';
          ctx.stroke();
          
          // Draw connection label on hover/highlight
          if (isHighlighted && connType) {
            ctx.fillStyle = '#F8FAFC';
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
              connType.replace('_', ' '),
              controlX,
              controlY - 5
            );
          }
        }
      });

      // Draw nodes on top of connections
      positionedNodes.forEach(node => {
        if (!node.node_position) return;

        const { x, y } = node.node_position;
        const isHighlighted = highlightedNodes.includes(node.id);

        const radius = isHighlighted ? 12 : 10;
        const hasAvatar = node.avatar && !brokenImageCache.current.has(node.avatar);

        // Node shadow
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#000000';
        ctx.fill();

        ctx.globalAlpha = 1;

        const drawFallback = () => {
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          if (isHighlighted) {
            gradient.addColorStop(0, '#60A5FA');
            gradient.addColorStop(1, '#1E40AF');
          } else {
            gradient.addColorStop(0, '#64748B');
            gradient.addColorStop(1, '#334155');
          }
          ctx.fillStyle = gradient;
          ctx.fill();
        };

        if (hasAvatar) {
          const img = imageCache.current.get(node.avatar!);
          if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
            ctx.restore();
          } else {
            drawFallback();
            const newImg = new Image();
            newImg.crossOrigin = 'Anonymous';
            newImg.onload = () => {
              imageCache.current.set(node.avatar!, newImg);
              setImagesLoaded(prev => prev + 1);
            };
            newImg.onerror = () => {
              console.warn(`Failed to load image (CORS or broken link): ${node.avatar}`);
              brokenImageCache.current.add(node.avatar!);
              setImagesLoaded(prev => prev + 1);
            };
            newImg.src = node.avatar!;
          }
        } else {
          drawFallback();
        }

        // Node border
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = isHighlighted ? '#1E40AF' : '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Node label with background when zoomed in
        if (zoom >= LABEL_VISIBILITY_ZOOM_THRESHOLD) {
          const label = node.name || 'Unknown';
          const fontSize = Math.min(10, 10 * zoom);
          ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const padding = 2;
          const textWidth = ctx.measureText(label).width;
          const bgX = x - textWidth / 2 - padding;
          const bgY = y + radius + 4;
          const bgHeight = fontSize + padding * 2;
          const bounds = { x: bgX, y: bgY, width: textWidth + padding * 2, height: bgHeight };
          const intersects = drawnLabelBounds.some(b =>
            bounds.x < b.x + b.width &&
            bounds.x + bounds.width > b.x &&
            bounds.y < b.y + b.height &&
            bounds.y + bounds.height > b.y
          );
          if (!intersects) {
            ctx.fillStyle = 'rgba(15,23,42,0.7)';
            ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(label, x, bgY + padding);
            ctx.textBaseline = 'alphabetic';
            drawnLabelBounds.push(bounds);
          }
        }
      });

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
