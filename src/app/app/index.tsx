"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { GraphData, Link, Node } from '@/features/graph/types';
import { loadGraph, upsertGraph } from '@/features/graph/supabase-graph-service';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';
import styles from './app.module.css';
import { cn } from '@/utils/tailwind';

const HIGH_LEVEL_CATEGORIES = [
  'Computer Science',
  'Cooking',
  'Music',
  'Sports',
  'Mathematics',
  'Art',
  'Literature',
  'Science',
];

const INITIAL_NODES: Node[] = HIGH_LEVEL_CATEGORIES.map((name, idx) => ({
  id: idx,
  name,
  group: 0,
}));

const COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
  '#ffeaa7', '#dfe6e9', '#a29bfe', '#fd79a8'
];

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

export default function AppView() {
  const { user } = useSession();

  const [data, setData] = useState<GraphData>({
    nodes: INITIAL_NODES,
    links: []
  });

  const [graphDataLoaded, setGraphDataLoaded]= useState<boolean>(false);
  const [loading, setLoading] = useState<number | null>(null);
  const graphRef = useRef<any>(null);
  const nextId = useRef(INITIAL_NODES.length);

  // Load graph data
  useEffect(() => {
    if (!user) {
      return;
    }

    console.log("[LOG] Loading data");
    async function loadData() {
      const graph = await loadGraph(user!.id);
      if (graph && graph.graph_data) {
        setData(graph.graph_data);
        // Sync nextId so new nodes don't collide with existing ones
        const maxId = Math.max(...graph.graph_data.nodes.map((n: Node) => n.id));
        nextId.current = maxId + 1;
        setGraphDataLoaded(true);
      }
    }
      
    if (!graphDataLoaded) {
      loadData(); 
    }
  }, [user]);

  async function handleGraphSave() {
    // Strip position information
    const sanitisedData = {
      nodes: data.nodes.map(({ id, name, group }) => ({ id, name, group })),
      links: data.links.map((link) => ({
        source: (link.source as Node)?.id ?? link.source,
        target: (link.target as Node)?.id ?? link.target,
      })),
    };

    if (user) {
      await upsertGraph(user.id, sanitisedData)
    }
  }

  const handleNodeClick = useCallback(async (node: any) => {
    if (loading !== null) return;

    const hasChildren = data.links.some(
      (link) => (link.source as Node).id === node.id || link.source === node.id
    );
    if (hasChildren) {
      graphRef.current?.centerAt(node.x, node.y, 1000);
      graphRef.current?.zoom(2, 1000);
      return;
    }

    graphRef.current?.centerAt(node.x, node.y, 500);
    graphRef.current?.zoom(1.5, 500);

    setLoading(node.id);

    try {
      // Refactor to tanstack
      const response = await fetch('/api/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: node.name }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', response.status, errorText);
        setLoading(null);
        return;
      }

      const result = await response.json();
      if (result.subcategories && Array.isArray(result.subcategories)) {
        const subcategories = result.subcategories.slice(0, 7);

        setData((prev) => {
          const newNodes: Node[] = subcategories.map((name: string) => ({
            id: nextId.current++,
            name,
            group: node.group + 1,
          }));

          const newLinks: Link[] = newNodes.map((newNode) => ({
            source: node.id,
            target: newNode.id,
          }));

          return {
            nodes: [...prev.nodes, ...newNodes],
            links: [...prev.links, ...newLinks],
          };
        });
      }
    } catch (error) {
      console.error('Error generating subcategories:', error);
    } finally {
      setLoading(null);
    }
  }, [data.links, loading]);

  const hasChildren = (nodeId: number): boolean => {
    return data.links.some(
      (link) => (link.source as Node).id === nodeId || link.source === nodeId
    );
  };

  if (!user) {
    return;
  }

  console.log(user.id);

  return (
    <div className={cn("min-h-screen w-full", styles.root)}>
      <Button onClick={handleGraphSave}>Upload graph data</Button>
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        nodeAutoColorBy="group"
        nodeLabel={""}
        onNodeClick={handleNodeClick}
        nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
          const label = node.name;
          const fontSize = 14 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

          const nodeColor = loading === node.id ? '#ffd700' : hasChildren(node.id) ?  "oklch(0.6941 0.1233 238.24)" : "oklch(0.5412 0.0789 238.24)";

          ctx.beginPath();
          ctx.arc(node.x, node.y, 5 + node.group, 0, 2 * Math.PI);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          const showLabel = node.group <= 1 || globalScale > 1.5;

          if (showLabel) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0)';
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2 - 10,
              ...bckgDimensions
            );

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'oklch(0.7735 0.0962 57.72)';
            ctx.fillText(label, node.x, node.y - 10);
          }

          node.__bckgDimensions = bckgDimensions;
        }}
        nodePointerAreaPaint={(node: any, color: any, ctx: any) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 5 + node.group, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkDirectionalArrowLength={0}
        linkDirectionalArrowRelPos={1}
        linkColor={() => 'oklch(0.7176 0.0691 57.72)'}
      />
      {loading !== null && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '15px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ color: '#fff', fontSize: '16px' }}>Generating subcategories...</span>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}