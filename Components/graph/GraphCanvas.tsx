import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
type NodeObject = any;
type LinkObject = any;
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Person, Connection } from '@/Entities/all';
import { useTheme } from '../ui/ThemeProvider';

const CENTRAL_USER_ID = "eldar-refael-hacohen-58b4b018a";

const lightColors = {
    background: 'hsl(240 10% 99%)',
    node: 'hsl(215 28% 92%)',
    centralNode: 'hsl(217 91% 60%)',
    highlight: '#22c55e',
    text: 'hsl(222 47% 11%)',
    initialsText: 'hsl(215 20% 55%)',
    work: '#FFC107',
    study: '#F44336',
};

const darkColors = {
    background: 'hsl(225 15% 9%)',
    node: 'hsl(217 33% 17%)',
    centralNode: 'hsl(217 91% 60%)',
    highlight: '#22c55e',
    text: 'hsl(210 20% 98%)',
    initialsText: 'hsl(210 40% 98%)',
    work: '#FFC107',
    study: '#F44336',
};

// Re-exporting for clarity in this component
type GraphNode = NodeObject & Person & { 
  isHighlighted?: boolean;
  avatarImg?: HTMLImageElement;
};

type GraphLink = LinkObject & Connection & { 
  isHighlighted?: boolean; 
  source: string | number | GraphNode;
  target: string | number | GraphNode;
};

interface GraphCanvasProps {
  nodes: Person[];
  connections: Connection[];
  highlightedNodeIds?: string[];
  highlightedConnections?: string[];
  onNodeClick?: (nodeId: string) => void;
  onBackgroundClick?: () => void;
  currentUser?: Person | null;
}

export default function GraphCanvas({
  nodes = [],
  connections = [],
  highlightedNodeIds = [],
  highlightedConnections = [],
  onNodeClick,
  onBackgroundClick,
  currentUser,
}: GraphCanvasProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [avatarImages, setAvatarImages] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setAvatarImages({}); // Clear previous images

    nodes.forEach(p => {
      const avatarUrl = p.profile_picture_url || p.avatar;
      if (!avatarUrl) return;

      const img = new Image();
      img.onload = () => {
        if (isMounted) {
          setAvatarImages(prev => ({ ...prev, [p.id]: img }));
        }
      };
      // We don't handle onerror to avoid complexity, missing images will just not render
      img.src = avatarUrl;
    });

    return () => { isMounted = false; };
  }, [nodes]);

  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = nodes.map(p => {
      const node: GraphNode = {
      ...p,
      id: p.id,
      isHighlighted: highlightedNodeIds.includes(p.id),
      avatarImg: avatarImages[p.id],
      };
      if (p.id === CENTRAL_USER_ID) {
        node.fx = 0;
        node.fy = 0;
      }
      return node;
    });

    // Filter out connections that reference non-existent nodes
    const nodeIds = new Set(graphNodes.map(n => n.id));
    const validConnections = connections.filter(conn => 
      nodeIds.has(conn.person_a_id) && nodeIds.has(conn.person_b_id)
    );

    const graphLinks: GraphLink[] = validConnections.map(c => ({
      ...c,
      source: c.person_a_id,
      target: c.person_b_id,
      isHighlighted: highlightedConnections.includes(c.id),
      type: c.connection_type, // Map connection_type to type for consistency
    }));

    // Sort to bring highlighted elements to the front (drawn last)
    graphNodes.sort((a, b) => (a.isHighlighted ? 1 : 0) - (b.isHighlighted ? 1 : 0));
    graphLinks.sort((a, b) => (a.isHighlighted ? 1 : 0) - (b.isHighlighted ? 1 : 0));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, connections, highlightedNodeIds, highlightedConnections, avatarImages]);
  
  const { theme } = useTheme();
  const canvasColors = useMemo(() => (theme === 'dark' ? darkColors : lightColors), [theme]);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('link').distance((link: any) => {
        const isConnectedToCenter = link.source.id === CENTRAL_USER_ID || link.target.id === CENTRAL_USER_ID;
        return isConnectedToCenter ? 250 : 100;
      });
      fgRef.current.d3Force('charge').strength(-200);
    }
  }, [graphData]);

  const handleNodeClick = useCallback((node: NodeObject) => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }

    // Defer the animation and position calculation to allow the state to update
    // and to ensure graph engine has settled on coordinates.
    setTimeout(() => {
        if (fgRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
            fgRef.current.centerAt(node.x, node.y, 1000);
            fgRef.current.zoom(2, 500);
        }
    }, 0);
  }, [onNodeClick]);

  const nodeCanvasObject = useCallback((node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const graphNode = node as GraphNode;
    const { x, y, name, isHighlighted, avatarImg, id } = graphNode;

    const isCentralNode = id === CENTRAL_USER_ID;
    const baseRadius = isCentralNode ? 80 : 5;
    const radius = isHighlighted ? baseRadius * 1.2 : baseRadius;
    const label = name || '';

    // Draw Node Circle
    ctx.beginPath();
    ctx.arc(x!, y!, radius, 0, 2 * Math.PI, false);
    if (isHighlighted) {
      ctx.fillStyle = canvasColors.highlight;
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = isCentralNode ? canvasColors.centralNode : canvasColors.node;
    }
    ctx.fill();
    if (isHighlighted) {
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw avatar image
    if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = (isHighlighted || isCentralNode) ? 1 : 0.6;
      ctx.beginPath();
      ctx.arc(x!, y!, radius, 0, 2 * Math.PI, false);
      ctx.clip();
      ctx.drawImage(avatarImg, x! - radius, y! - radius, radius * 2, radius * 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
        // Fallback to initials if no image
        const initials = name?.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '';
        const fontSize = radius;
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = canvasColors.initialsText;
        ctx.fillText(initials, x!, y!);
    }

    // Draw label when zoomed in
    if (globalScale > 1.5) {
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
      ctx.fillStyle = canvasColors.text;
      ctx.fillText(label, x!, y! + radius + fontSize);
        }
  }, [canvasColors]);

  const linkCanvasObject = useCallback((link: LinkObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const graphLink = link as GraphLink;
    // Type guard to ensure we have node objects, not just IDs
    const sourceNode = typeof graphLink.source === 'object' ? graphLink.source as unknown as GraphNode : null;
    const targetNode = typeof graphLink.target === 'object' ? graphLink.target as unknown as GraphNode : null;

    // Guard clause to ensure both nodes and their coordinates are valid
    if (!sourceNode || !targetNode || sourceNode.x === undefined || sourceNode.y === undefined || targetNode.x === undefined || targetNode.y === undefined) {
      return; // Skip drawing this link if data is not ready
    }

    const { x: sx, y: sy } = sourceNode;
    const { x: tx, y: ty } = targetNode;
    
    // Only draw WORK and STUDY connections
    if (graphLink.type !== 'WORK' && graphLink.type !== 'STUDY') {
      return;
    }
    
    const color = graphLink.isHighlighted ? canvasColors.highlight : (graphLink.type === 'WORK' ? canvasColors.work : canvasColors.study);
    const width = graphLink.isHighlighted ? 3 : 1;

    // Arched path
    const dx = tx - sx;
    const dy = ty - sy;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const offset = distance * 0.2;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const nx = -dy / distance;
    const ny = dx / distance;
    const cpx = mx + nx * offset;
    const cpy = my + ny * offset;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cpx, cpy, tx, ty);
    ctx.strokeStyle = color;
    ctx.lineWidth = width / globalScale;
    ctx.globalAlpha = graphLink.isHighlighted ? 1 : 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [canvasColors]);

  const nodePointerAreaPaint = useCallback((node: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
    const graphNode = node as GraphNode;
    const { x, y, id } = graphNode;

    if (x === undefined || y === undefined) return;

    const isCentralNode = id === CENTRAL_USER_ID;
    const baseRadius = isCentralNode ? 80 : 5;
    const interactiveRadius = isCentralNode ? baseRadius * 1.5 : baseRadius;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, interactiveRadius, 0, 2 * Math.PI, false);
    ctx.fill();
  }, []);

  const resetView = () => {
    if (fgRef.current) {
        fgRef.current.zoomToFit(400, 100);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-background rounded-2xl border border-border overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor={canvasColors.background}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => "replace"}
        onNodeClick={handleNodeClick}
        onBackgroundClick={onBackgroundClick}
        cooldownTicks={100}
        onEngineStop={() => fgRef.current?.zoomToFit(400, 50)}
        enableZoomInteraction
        enablePanInteraction
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() + 0.2, 500)}
          className="w-10 h-10 rounded-xl bg-card/80 backdrop-blur-sm border-border text-muted-foreground hover:text-foreground"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() - 0.2, 500)}
          className="w-10 h-10 rounded-xl bg-card/80 backdrop-blur-sm border-border text-muted-foreground hover:text-foreground"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={resetView}
          className="w-10 h-10 rounded-xl bg-card/80 backdrop-blur-sm border-border text-muted-foreground hover:text-foreground"
        >
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* Graph Stats */}
      <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border px-4 py-2">
        <div className="text-sm text-muted-foreground">
          <span className="text-primary font-medium">{nodes.length}</span> nodes • 
          <span className="text-primary font-medium ml-1">{connections.length}</span> connections
        </div>
      </div>

      {/* Connection Legend */}
      <div className="absolute bottom-4 right-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border px-4 py-2">
        <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">Connection Legend</h4>
        <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: canvasColors.work }}></div>
              <span className="text-sm text-muted-foreground capitalize">Work</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: canvasColors.study }}></div>
              <span className="text-sm text-muted-foreground capitalize">Study</span>
            </div>
        </div>
      </div>

      {/* Loading State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading network graph...</p>
          </div>
        </div>
      )}
    </div>
  );
}
