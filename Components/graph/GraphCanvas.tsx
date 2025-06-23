import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
type NodeObject = any;
type LinkObject = any;
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Person, Connection } from '@/Entities/all';

const CONNECTION_TYPE_COLOR: Record<string, string> = {
  WORK: '#FFC107',
  STUDY: '#F44336',
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
}

export default function GraphCanvas({
  nodes = [],
  connections = [],
  highlightedNodeIds = [],
  highlightedConnections = [],
  onNodeClick,
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
    const graphNodes: GraphNode[] = nodes.map(p => ({
      ...p,
      id: p.id,
      isHighlighted: highlightedNodeIds.includes(p.id),
      avatarImg: avatarImages[p.id],
    }));

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

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, connections, highlightedNodeIds, highlightedConnections, avatarImages]);
  
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('link')?.distance(100);
      fgRef.current.d3Force('charge')?.strength(-150);
    }
  }, []);

  const handleNodeClick = useCallback((node: NodeObject) => {
    const graphNode = node as GraphNode;
    if (onNodeClick) {
      onNodeClick(graphNode.id);
    }
    // Center and zoom on node
    if (fgRef.current && typeof graphNode.x === 'number' && typeof graphNode.y === 'number') {
        fgRef.current.centerAt(graphNode.x, graphNode.y, 1000);
        fgRef.current.zoom(2, 500);
    }
  }, [onNodeClick]);
  
  const nodeCanvasObject = useCallback((node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const graphNode = node as GraphNode;
    const { x, y, name, isHighlighted, avatarImg } = graphNode;
    const baseRadius = 5;
    const radius = isHighlighted ? baseRadius * 1.8 : baseRadius;
    const label = name || '';

    // Draw Node Circle
    ctx.beginPath();
    ctx.arc(x!, y!, radius, 0, 2 * Math.PI, false);
    if (isHighlighted) {
      ctx.fillStyle = '#3B82F6';
      ctx.shadowColor = '#60A5FA';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = 'rgba(51,65,85,0.5)';
    }
    ctx.fill();
    if (isHighlighted) {
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw avatar image
    if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
      ctx.save();
      ctx.globalAlpha = isHighlighted ? 1 : 0.6;
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
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(initials, x!, y!);
    }

    // Draw label when zoomed in
    if (globalScale > 1.5) {
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(label, x!, y! + radius + fontSize);
        }
  }, []);

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
    
    const color = CONNECTION_TYPE_COLOR[graphLink.type];
    const width = graphLink.isHighlighted ? 2.5 : 1;

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
  }, []);

  const resetView = () => {
    if (fgRef.current) {
        fgRef.current.zoomToFit(400, 100);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 rounded-2xl border border-slate-700/50 overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="#0F172A"
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => "replace"}
        onNodeClick={handleNodeClick}
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
          className="w-10 h-10 rounded-xl bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 text-slate-300 hover:text-white"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fgRef.current?.zoom(fgRef.current.zoom() - 0.2, 500)}
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
          <span className="text-blue-400 font-medium">{nodes.length}</span> nodes • 
          <span className="text-indigo-400 font-medium ml-1">{connections.length}</span> connections
        </div>
      </div>

      {/* Loading State */}
      {nodes.length === 0 && (
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
