"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { GraphData, Link, Node } from "@/features/graph/types";
import {
  loadGraph,
  upsertGraph,
} from "@/features/graph/supabase-graph-service";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/useSession";
import styles from "./app.module.css";
import { cn } from "@/utils/tailwind";
import { Search, Plus } from "lucide-react";

const HIGH_LEVEL_CATEGORIES = [
  "Computer Science",
  "Cooking",
  "Music",
  "Sports",
  "Mathematics",
  "Art",
  "Literature",
  "Science",
];

const INITIAL_NODES: Node[] = HIGH_LEVEL_CATEGORIES.map((name, idx) => ({
  id: idx,
  name,
  group: 0,
  depth: 0,
}));

const COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#ffeaa7",
  "#dfe6e9",
  "#a29bfe",
  "#fd79a8",
];

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

export default function AppView() {
  const { user } = useSession();

  const [data, setData] = useState<GraphData>({
    nodes: INITIAL_NODES,
    links: [],
  });

  const [graphDataLoaded, setGraphDataLoaded] = useState<boolean>(false);
  const [loading, setLoading] = useState<number | null>(null);
  const [errorNodes, setErrorNodes] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState(false);
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
        const maxId = Math.max(
          ...graph.graph_data.nodes.map((n: Node) => n.id),
        );
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
      nodes: data.nodes.map(({ id, name, group, depth }) => ({
        id,
        name,
        group,
        depth,
      })),
      links: data.links.map((link) => ({
        source: (link.source as Node)?.id ?? link.source,
        target: (link.target as Node)?.id ?? link.target,
      })),
    };

    if (user) {
      await upsertGraph(user.id, sanitisedData);
    }
  }

  const handleNodeClick = useCallback(
    async (node: any) => {
      if (loading !== null) return;

      const hasChildren = data.links.some(
        (link) =>
          (link.source as Node).id === node.id || link.source === node.id,
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
        const response = await fetch("/api/subcategories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: node.name }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error:", response.status, errorText);
          setErrorNodes((prev) => [...prev, node.id]);
          setTimeout(() => {
            setErrorNodes((prev) => prev.filter((id) => id !== node.id));
          }, 3000);
          setLoading(null);
          return;
        }

        const result = await response.json();
        if (
          result.subcategories &&
          Array.isArray(result.subcategories) &&
          result.subcategories.length > 0
        ) {
          const subcategories = result.subcategories.slice(0, 7);

          setData((prev) => {
            const newNodes: Node[] = subcategories.map((name: string) => ({
              id: nextId.current++,
              name,
              group: node.group + 1,
              depth: node.depth + 1,
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
        } else {
          setErrorNodes((prev) => [...prev, node.id]);
          setTimeout(() => {
            setErrorNodes((prev) => prev.filter((id) => id !== node.id));
          }, 3000);
        }
      } catch (error) {
        console.error("Error generating subcategories:", error);
        setErrorNodes((prev) => [...prev, node.id]);
        setTimeout(() => {
          setErrorNodes((prev) => prev.filter((id) => id !== node.id));
        }, 3000);
      } finally {
        setLoading(null);
      }
    },
    [data.links, loading],
  );

  const hasChildren = (nodeId: number): boolean => {
    return data.links.some(
      (link) => (link.source as Node).id === nodeId || link.source === nodeId,
    );
  };

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;

    const query = searchQuery.toLowerCase();
    const foundNode = data.nodes.find((node) =>
      node.name.toLowerCase().includes(query),
    );

    if (foundNode) {
      setSearchError(false);
      const nodeWithPosition = foundNode as Node & { x?: number; y?: number };
      if (
        nodeWithPosition.x !== undefined &&
        nodeWithPosition.y !== undefined
      ) {
        graphRef.current?.centerAt(nodeWithPosition.x, nodeWithPosition.y, 500);
        graphRef.current?.zoom(2, 500);
      } else {
        graphRef.current?.zoomToFit(
          500,
          1,
          (node: any) => node.id === foundNode.id,
        );
      }
    } else {
      setSearchError(true);
      let count = 0;
      const interval = setInterval(() => {
        count++;
        setSearchError((prev) => !prev);
        if (count >= 6) {
          clearInterval(interval);
          setSearchError(false);
        }
      }, 200);
    }
  }, [searchQuery, data.nodes]);

  const handleAddNode = useCallback(() => {
    const randomName = searchQuery.trim() || `Node ${nextId.current}`;

    const newNode: Node & { x?: number; y?: number } = {
      id: nextId.current++,
      name: randomName,
      group: 0,
      depth: 0,
    };

    const randomX = (Math.random() - 0.5) * 500;
    const randomY = (Math.random() - 0.5) * 500;
    newNode.x = randomX;
    newNode.y = randomY;

    setData((prev) => ({
      nodes: [...prev.nodes, newNode],
      links: [...prev.links],
    }));

    setSearchQuery("");
    setSearchError(false);

    setTimeout(() => {
      if (newNode.x !== undefined && newNode.y !== undefined) {
        graphRef.current?.centerAt(newNode.x, newNode.y, 500);
        graphRef.current?.zoom(2, 500);
      }
    }, 100);
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  if (!user) {
    return;
  }

  console.log(user.id);

  return (
    <div className={cn("min-h-screen w-full relative", styles.root)}>
      <div
        className={cn(
          "absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full border border-border px-2 py-1.5 shadow-sm transition-colors",
          searchError && "border-red-500 border-2",
        )}
      >
        <Input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchError(false);
          }}
          onKeyDown={handleKeyDown}
          className="border-0 bg-transparent focus-visible:ring-0 rounded-full w-48 h-8 text-sm"
        />
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={handleSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8"
          onClick={handleAddNode}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
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
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2,
          );

          const nodeColor =
            loading === node.id
              ? "#ef4444"
              : hasChildren(node.id)
                ? "oklch(0.6941 0.1233 238.24)"
                : "oklch(0.5412 0.0789 238.24)";

          ctx.beginPath();
          ctx.arc(node.x, node.y, 5 + node.group, 0, 2 * Math.PI);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          if (loading === node.id) {
            const ringRadius = 5 + node.group + 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, ringRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            ctx.stroke();

            const time = Date.now() / 200;
            ctx.beginPath();
            ctx.arc(node.x, node.y, ringRadius, time, time + Math.PI);
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          if (errorNodes.includes(node.id)) {
            const blink = Math.sin(Date.now() / 100) > 0;
            if (blink) {
              const ringRadius = 5 + node.group + 2;
              ctx.beginPath();
              ctx.arc(node.x, node.y, ringRadius, 0, 2 * Math.PI);
              ctx.strokeStyle = "#ef4444";
              ctx.lineWidth = 3;
              ctx.stroke();
            }
          }

          const showLabel = node.group <= 1 || globalScale > 1.5;

          if (showLabel) {
            ctx.fillStyle = "rgba(255, 255, 255, 0)";
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2 - 10,
              ...bckgDimensions,
            );

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "oklch(0.7735 0.0962 57.72)";
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
        linkColor={() => "oklch(0.7176 0.0691 57.72)"}
      />
    </div>
  );
}
