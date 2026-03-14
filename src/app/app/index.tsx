"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  GraphData,
  Link,
  Node,
  ResourceNode,
  TopicNode,
} from "@/features/graph/types";
import {
  loadGraph,
  upsertGraph,
} from "@/features/graph/supabase-graph-service";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import styles from "./app.module.css";
import { cn } from "@/utils/tailwind";
import InterestSelection, { InterestId } from "./InterestSelection.tsx";

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

const INTEREST_LABELS: Record<InterestId, string> = {
  programming: "Programming",
  cooking: "Cooking",
  music: "Music",
  fitness: "Fitness",
  mathematics: "Mathematics",
  art: "Art",
  literature: "Literature",
  science: "Science",
  gaming: "Gaming",
  travel: "Travel",
  health: "Health",
  photography: "Photography",
  nature: "Nature",
  technology: "Technology",
  movies: "Movies",
  finance: "Finance",
};

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
  source?: ResourceNode["source"];
  favicon?: string;
  snippet?: string;
};

type ExpansionResponse = {
  subcategories?: string[];
  resources?: ExpansionResource[];
};

function getLinkNodeId(node: number | Node) {
  return typeof node === "number" ? node : node.id;
}

function isResourceNode(node: Node): node is ResourceNode {
  return node.type === "resource";
}

function normaliseNode(node: Partial<Node>): Node {
  const depth = typeof node.depth === "number" ? node.depth : (node.group ?? 0);

  if (node.type === "resource" && typeof node.url === "string") {
    return {
      id: node.id!,
      name: node.name!,
      group: node.group!,
      depth,
      type: "resource",
      url: node.url,
      source: node.source ?? "web",
      favicon: node.favicon,
      snippet: node.snippet,
    };
  }

  return {
    id: node.id!,
    name: node.name!,
    group: node.group!,
    depth,
    type: "topic",
  };
}

function normaliseGraphData(graphData: GraphData): GraphData {
  return {
    nodes: graphData.nodes.map((node) => normaliseNode(node as Partial<Node>)),
    links: graphData.links,
  };
}

export default function AppView() {
  const { user } = useSession();

  const [interestsSelected, setInterestsSelected] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<InterestId[]>([]);

  const getInitialNodes = (): Node[] => {
    if (selectedInterests.length === 0) {
      return HIGH_LEVEL_CATEGORIES.map((name, idx) => ({
        id: idx,
        name,
        group: 0,
        depth: 0,
        type: "topic" as const,
      }));
    }
    return selectedInterests.map((id, idx) => ({
      id: idx,
      name: INTEREST_LABELS[id],
      group: 0,
      depth: 0,
      type: "topic" as const,
    }));
  };

  const [data, setData] = useState<GraphData>({
    nodes: getInitialNodes(),
    links: [],
  });

  const [graphDataLoaded, setGraphDataLoaded] = useState<boolean>(false);
  const [currentDepth, setCurrentDepth] = useState<number>(0);
  const [loading, setLoading] = useState<number | null>(null);
  const graphRef = useRef<any>(null);
  const focusedNodeRef = useRef<Node | null>(null);
  const nextId = useRef(getInitialNodes().length);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement | null>());
  const nodeStatesRef = useRef<Record<number, "idle" | "loading">>({});

  // Initialize node states for initial nodes
  useEffect(() => {
    const initialStates: Record<number, "idle" | "loading"> = {};
    getInitialNodes().forEach((node) => {
      initialStates[node.id] = "idle";
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
        const loadedStates: Record<number, "idle" | "loading"> = {};
        graph.graph_data.nodes.forEach((node) => {
          loadedStates[node.id] = "idle";
        });
        nodeStatesRef.current = loadedStates;

        // Sync nextId so new nodes don't collide with existing ones
        const maxId =
          normalisedGraph.nodes.length > 0
            ? Math.max(...normalisedGraph.nodes.map((n: Node) => n.id))
            : getInitialNodes().length - 1;
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
        node.type === "resource"
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
          },
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
      if (node.type === "resource") {
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
      nodeStatesRef.current[node.id] = "loading";
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
          setLoading(null);
          return;
        }

        const result: ExpansionResponse = await response.json();

        setData((prev) => {
          const existingTopicNames = new Set(
            prev.nodes
              .filter((existingNode) => existingNode.type !== "resource")
              .map((existingNode) => existingNode.name.trim().toLowerCase()),
          );
          const existingResourceUrls = new Set(
            prev.nodes
              .filter(isResourceNode)
              .map((existingNode) => existingNode.url),
          );

          const nextDepth =
            (typeof node.depth === "number" ? node.depth : (node.group ?? 0)) +
            1;
          const nextGroup = node.group + 1;
          const newTopicNodes: TopicNode[] = [];
          const newResourceNodes: ResourceNode[] = [];

          for (const name of Array.isArray(result.subcategories)
            ? result.subcategories.slice(0, 7)
            : []) {
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
              type: "topic",
            });
          }

          for (const resource of Array.isArray(result.resources)
            ? result.resources.slice(0, 5)
            : []) {
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
              type: "resource",
              url,
              source: resource.source ?? "web",
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
      } catch (error) {
        console.error("Error generating subcategories:", error);
      } finally {
        setLoading(null);
        nodeStatesRef.current[node.id] = "idle";
      }
    },
    [data.links, loading],
  );

  const hasChildren = (nodeId: number): boolean => {
    return data.links.some((link) => getLinkNodeId(link.source) === nodeId);
  };

  const handleInterestsSelected = (selected: InterestId[]) => {
    setSelectedInterests(selected);
    setInterestsSelected(true);
    setData({
      nodes: selected.map((id, idx) => ({
        id: idx,
        name: INTEREST_LABELS[id],
        group: 0,
        depth: 0,
        type: "topic" as const,
      })),
      links: [],
    });
  };

  if (!user) {
    return;
  }

  if (!interestsSelected) {
    return <InterestSelection onComplete={handleInterestsSelected} />;
  }

  console.log(user.id);

  return (
    <div className={cn("min-h-screen w-full", styles.root)}>
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
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2,
          );

          const isResource = node.type === "resource";

          const nodeColor = isResource
            ? "oklch(0.7294 0.111 66.71)"
            : nodeStatesRef.current[node.id] === "loading"
              ? "#ffd700"
              : hasChildren(node.id)
                ? "oklch(0.6941 0.1233 238.24)"
                : "oklch(0.4176 0.0592 238.24)";

          if (!isResource) {
            // Topic nodes
            ctx.beginPath();
            ctx.arc(node.x, node.y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = nodeColor;
            ctx.fill();
          } else {
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

            if (!node.favicon) {
              // Create placeholder
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(
                rectX + iconPadding + iconSize / 2,
                rectY + iconPadding + iconSize / 2,
                iconSize / 2,
                0,
                2 * Math.PI,
              );
              ctx.fill();
            } else {
              // Favicon is present store in cache
              let cachedImage = imageCacheRef.current.get(node.favicon);

              if (cachedImage === undefined) {
                cachedImage = new Image();
                cachedImage.crossOrigin = "anonymous";
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
                ctx.imageSmoothingQuality = "high";
                ctx.filter = "hue-rotate(185deg) saturate(1.15)";

                try {
                  ctx.drawImage(
                    cachedImage,
                    rectX + iconPadding,
                    rectY + iconPadding,
                    iconSize,
                    iconSize,
                  );
                } catch { }

                ctx.restore();
              }
            }
          }
          // Render labels
          const showLabel = node.type !== "resource";

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

          if (node.type === "resource") {
            const rectSize = 12 + node.group * 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, rectSize / 2, 0, 2 * Math.PI);
            ctx.fill();
            return;
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI);
          ctx.fill();
        }}
        d3AlphaDecay={0.02} // default 0.0228, lower = longer simulation
        d3VelocityDecay={0.7} // default 0.4, lower = nodes travel further
        linkDirectionalArrowLength={0}
        linkDirectionalArrowRelPos={1}
        linkColor={() => "oklch(0.7176 0.0691 57.72)"}
      />
    </div>
  );
}
