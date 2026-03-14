"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { GraphData, Link, Node, ResourceNode, TopicNode } from "@/features/graph/types";
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
  type: "topic",
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

type ExpansionResource = {
  title: string;
  url: string;
  source?: ResourceNode['source'];
  favicon?: string;
  snippet?: string;
};

type ExpansionResponse = {
  subcategories?: string[];
  resources?: ExpansionResource[];
};

function getLinkNodeId(node: number | Node) {
  return typeof node === 'number' ? node : node.id;
}

function isResourceNode(node: Node): node is ResourceNode {
  return node.type === 'resource';
}

function normaliseNode(node: Partial<Node> & { id: number; name: string; group: number }): Node {
  const depth = typeof node.depth === 'number' ? node.depth : node.group ?? 0;

  if (node.type === 'resource' && typeof node.url === 'string') {
    return {
      id: node.id,
      name: node.name,
      group: node.group,
      depth,
      type: 'resource',
      url: node.url,
      source: node.source ?? 'web',
      favicon: node.favicon,
      snippet: node.snippet,
    };
  }

  return {
    id: node.id,
    name: node.name,
    group: node.group,
    depth,
    type: 'topic',
  };
}

function normaliseGraphData(graphData: GraphData): GraphData {
  return {
    nodes: graphData.nodes.map((node) =>
      normaliseNode(node as Partial<Node> & { id: number; name: string; group: number }),
    ),
    links: graphData.links,
  };
}

export default function AppView() {
  const { user } = useSession();

  const [data, setData] = useState<GraphData>({
    nodes: INITIAL_NODES,
    links: [],
  });

  const [graphDataLoaded, setGraphDataLoaded] = useState<boolean>(false);
  const [currentDepth, setCurrentDepth] = useState<number>(0);
  const [loading, setLoading] = useState<number | null>(null);
  const [errorNodes, setErrorNodes] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState(false);
  const graphRef = useRef<any>(null);
  const focusedNodeRef = useRef<Node | null>(null);
  const nextId = useRef(INITIAL_NODES.length);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement | null>());
  const nodeStatesRef = useRef<Record<number, 'idle' | 'loading'>>({});

  // Initialize node states for initial nodes
  useEffect(() => {
    const initialStates: Record<number, 'idle' | 'loading'> = {};
    INITIAL_NODES.forEach(node => {
      initialStates[node.id] = 'idle';
    });
    nodeStatesRef.current = initialStates;
  }, []);

  // Load graph data
  useEffect(() => {
    if (!user) {
      return;
    }

    console.log("[LOG] Loading data");
    async function loadData() {
      const graph = await loadGraph(user!.id);
      if (graph && graph.graph_data) {
        const normalisedGraph = normaliseGraphData(graph.graph_data);
        setData(normalisedGraph);
        setData(graph.graph_data);

        // Initialize node states for loaded nodes
        const loadedStates: Record<number, 'idle' | 'loading'> = {};
        graph.graph_data.nodes.forEach(node => {
          loadedStates[node.id] = 'idle';
        });
        nodeStatesRef.current = loadedStates;

        // Sync nextId so new nodes don't collide with existing ones
        const maxId = normalisedGraph.nodes.length > 0
          ? Math.max(...normalisedGraph.nodes.map((n: Node) => n.id))
          : INITIAL_NODES.length - 1;
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
      nodes: data.nodes.map((node) =>
        node.type === 'resource'
          ? {
            id: node.id,
            name: node.name,
            group: node.group,
            depth: node.depth,
            type: node.type,
            url: node.url,
            source: node.source,
            favicon: node.favicon,
            snippet: node.snippet,
          }
          : {
            id: node.id,
            name: node.name,
            group: node.group,
            depth: node.depth,
            type: node.type,
          }
      ),
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
      if (node.type === 'resource') {
        window.open(node.url, "_blank", "noopener,noreferrer");
        return;
      }

      if (loading !== null) return;

      if (hasChildren(node.id)) {
        graphRef.current?.centerAt(node.x, node.y, 1000);
        return;
      }

      graphRef.current?.centerAt(node.x, node.y, 500);

      setLoading(node.id);
      nodeStatesRef.current[node.id] = 'loading';
      setCurrentDepth(node.depth);

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
          const existingTopicNames = new Set(
            prev.nodes
              .filter((existingNode) => existingNode.type !== 'resource')
              .map((existingNode) => existingNode.name.trim().toLowerCase()),
          );
          const existingResourceUrls = new Set(
            prev.nodes
              .filter(isResourceNode)
              .map((existingNode) => existingNode.url),
          );

          const nextDepth = (typeof node.depth === 'number' ? node.depth : node.group ?? 0) + 1;
          const nextGroup = node.group + 1;
          const newTopicNodes: TopicNode[] = [];
          const newResourceNodes: ResourceNode[] = [];

          for (const name of Array.isArray(result.subcategories) ? result.subcategories.slice(0, 7) : []) {
            const trimmedName = name.trim();
            const topicKey = trimmedName.toLowerCase();

            if (!trimmedName || existingTopicNames.has(topicKey)) {
              continue;
            }

            existingTopicNames.add(topicKey);
            newTopicNodes.push({
              id: nextId.current++,
              name: trimmedName,
              group: nextGroup,
              depth: nextDepth,
              type: 'topic',
            });
          }

          for (const resource of Array.isArray(result.resources) ? result.resources.slice(0, 5) : []) {
            const url = resource.url?.trim();

            if (!url || existingResourceUrls.has(url)) {
              continue;
            }

            existingResourceUrls.add(url);
            newResourceNodes.push({
              id: nextId.current++,
              name: resource.title?.trim() || url,
              group: nextGroup,
              depth: nextDepth,
              type: 'resource',
              url,
              source: resource.source ?? 'web',
              favicon: resource.favicon?.trim() || undefined,
              snippet: resource.snippet?.trim() || undefined,
            });
          }

          const newNodes: Node[] = [...newTopicNodes, ...newResourceNodes];
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
        nodeStatesRef.current[node.id] = 'idle';
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
      <p>Current Depth: {currentDepth}</p>
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        nodeAutoColorBy="group"
        nodeLabel={""}
        onNodeClick={handleNodeClick}
        width={window.innerWidth}
        height={window.innerHeight}
        nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
          const label = node.name;
          const fontSize = 14 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);
          const isResource = node.type === "resource";

          const nodeColor = isResource 
            ? "oklch(0.7294 0.111 66.71)" 
            : nodeStatesRef.current[node.id] === "loading" 
            ? '#ffd700' : hasChildren(node.id) 
            ? "oklch(0.6941 0.1233 238.24)" 
            : "oklch(0.4176 0.0592 238.24)";

          if (isResource) {
            const rectSize = 12 + node.group * 2;
            const rectX = node.x - rectSize / 2;
            const rectY = node.y - rectSize / 2;
            const radius = rectSize / 2;
            const iconPadding = Math.max(2, rectSize * 0.12);
            const iconSize = rectSize - iconPadding * 2;

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = nodeColor;
            ctx.fill();

            if (node.favicon) {
              let cachedImage = imageCacheRef.current.get(node.favicon);

              if (cachedImage === undefined) {
                cachedImage = new Image();
                cachedImage.crossOrigin = 'anonymous';
                cachedImage.onload = () => graphRef.current?.refresh?.();
                cachedImage.onerror = () => {
                  imageCacheRef.current.set(node.favicon, null);
                  graphRef.current?.refresh?.();
                };
                cachedImage.src = node.favicon;
                imageCacheRef.current.set(node.favicon, cachedImage);
              }

              if (cachedImage && cachedImage.complete) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(
                  rectX + iconPadding + iconSize / 2,
                  rectY + iconPadding + iconSize / 2,
                  iconSize / 2,
                  0,
                  2 * Math.PI,
                );
                ctx.clip();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.filter = 'hue-rotate(185deg) saturate(1.15)';

                try {
                  ctx.drawImage(
                  cachedImage,
                  rectX + iconPadding,
                  rectY + iconPadding,
                  iconSize,
                  iconSize,
                  );
                 } catch {
                  ;;
                 }
                
                ctx.restore();
              } else {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(
                  rectX + iconPadding + iconSize / 2,
                  rectY + iconPadding + iconSize / 2,
                  iconSize / 2,
                  0,
                  2 * Math.PI,
                );
                ctx.fill();
              }
            } else {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(
                rectX + iconPadding + iconSize / 2,
                rectY + iconPadding + iconSize / 2,
                iconSize / 2,
                0,
                2 * Math.PI,
              );
              ctx.fill();
            }
          } else {
            ctx.beginPath();
            ctx.arc(node.x, node.y, 5 + node.group, 0, 2 * Math.PI);
            ctx.fillStyle = nodeColor;
            ctx.fill();
          }
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

          const showLabel = node.type !== 'resource' && (node.group <= 1 || globalScale > 1.5);

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

          if (node.type === 'resource') {
            const rectSize = 12 + node.group * 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, rectSize / 2, 0, 2 * Math.PI);
            ctx.fill();
            return;
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }}
        d3AlphaDecay={0.02}     // default 0.0228, lower = longer simulation
        d3VelocityDecay={0.2}   // default 0.4, lower = nodes travel further
        linkDirectionalArrowLength={0}
        linkDirectionalArrowRelPos={1}
        linkColor={() => "oklch(0.7176 0.0691 57.72)"}
      />
    </div>
  );
}
