"use client";
import React, { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

interface Node {
  id: number;
  name: string;
  group: number;
}

interface Link {
  source: number | Node;
  target: number | Node;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

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

export default function Home() {
  const [data, setData] = useState<GraphData>({
    nodes: INITIAL_NODES,
    links: []
  });
  const [loading, setLoading] = useState<number | null>(null);
  const graphRef = useRef<any>(null);
  const nextId = useRef(INITIAL_NODES.length);

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

        setTimeout(() => {
          graphRef.current?.zoomToFit(400);
        }, 100);
      }
    } catch (error) {
      console.error('Error generating subcategories:', error);
    } finally {
      setLoading(null);
    }
  }, [data.links, loading]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        nodeAutoColorBy="group"
        nodeLabel={(node: any) => node.name}
        onNodeClick={handleNodeClick}
        nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
          const label = node.name;
          const fontSize = 14 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

          const nodeColor = loading === node.id ? '#ffd700' : COLORS[node.group % COLORS.length];

          ctx.beginPath();
          ctx.arc(node.x, node.y, 5 + node.group, 0, 2 * Math.PI);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          const showLabel = node.group <= 1 || globalScale > 1.5;

          if (showLabel) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2 - 10,
              ...bckgDimensions
            );

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000';
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
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkColor={() => '#999999'}
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
