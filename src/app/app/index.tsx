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
import { useSession } from "@/hooks/useSession";
import { cn } from "@/utils/tailwind";
import InterestSelection, {
  InterestId,
  hasUserSelectedInterests,
  getUserInterests,
} from "./InterestSelection";
import { toast } from 'sonner';
import MetricPanel from '@/features/graph/components/metric-panel';
import Navbar from '@/components/navbar';
import { useSound } from "@/hooks/useSound";
import { L } from "vitest/dist/chunks/reporters.nr4dxCkA.js";

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

export default function AppView() {
  const { user, onboardingCompleted } = useSession();

  const { playOnce: click } = useSound("click");
  const { playOnce: fan } = useSound("fan");

  const [interestsSelected, setInterestsSelected] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<InterestId[]>([]);

  const getInitialNodes = (): Node[] => {
    if (selectedInterests.length === 0) {
      return HIGH_LEVEL_CATEGORIES.map((name, idx) => ({
        id: idx,
        name,
        group: 0,
        depth: 0,
        type: "top-level",
      }));
    }
    return selectedInterests.map((id, idx) => ({
      id: idx,
      name: INTEREST_LABELS[id],
      group: 0,
      depth: 0,
      type: "top-level",
    }));
  };

  const [data, setData] = useState<GraphData>({
    nodes: getInitialNodes(),
    links: [],
  });

  const [graphDataLoaded, setGraphDataLoaded] = useState<boolean>(false);
  const [currentDepth, setCurrentDepth] = useState<number>(0);
  const [nodesExplored, setNodesExplored] = useState<number>(0);
  const [deepestLevel, setDeepestLevel] = useState<number>(0);

  const graphRef = useRef<any>(null);
  const nextId = useRef(getInitialNodes().length);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement | null>());
  const nodeStatesRef = useRef<Record<number, "idle" | "loading">>({});
  const hoveredNodeRef = useRef<Node | null>(null);

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
      if (graph) {
        setData(graph.graph_data);
        setCurrentDepth(graph.current_depth);
        setNodesExplored(graph.nodes_explored);
        setDeepestLevel(graph.deepest_level);

        // Initialize node states for loaded nodes
        const loadedStates: Record<number, "idle" | "loading"> = {};
        graph.graph_data.nodes.forEach((node) => {
          loadedStates[node.id] = "idle";
        });
        nodeStatesRef.current = loadedStates;

        // Sync nextId so new nodes don't collide with existing ones
        const maxId =
          data.nodes.length > 0
            ? Math.max(...data.nodes.map((n: Node) => n.id))
            : getInitialNodes().length - 1;
        nextId.current = maxId + 1;
        setGraphDataLoaded(true);
      }
    }

    if (!graphDataLoaded) {
      loadData();
    }
  }, [user]);

  async function handleGraphSave(
    graphData: GraphData,
    sessionInfo: { currentDepth: number; nodesExplored: number; deepestLevel: number }
  ) {
    // Strip position information
    const sanitisedData = {
      nodes: graphData.nodes.map((node) =>
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
      links: graphData.links.map((link) => ({
        source: (link.source as Node)?.id ?? link.source,
        target: (link.target as Node)?.id ?? link.target,
      })),
    };

    if (user) {
      await upsertGraph(user.id, sanitisedData,
        {
          currentDepth: sessionInfo.currentDepth,
          nodesExplored: sessionInfo.nodesExplored,
          deepestLevel: sessionInfo.deepestLevel
        });
    }
  }

  const handleNodeClick = useCallback(
    async (node: any) => {
      if (node.type === "resource") {
        window.open(node.url, "_blank", "noopener,noreferrer");
        return;
      }

      click();

      // Don't explore any nodes that have children i.e have already been explored
      if (hasChildren(node.id)) {
        graphRef.current?.centerAt(node.x, node.y, 1000);
        // maybe play a diff sound
        return;
      }

      graphRef.current?.centerAt(node.x, node.y, 500);

      nodeStatesRef.current[node.id] = 'loading';

      const newDepth = node.depth;
      let newDeepest = deepestLevel;
      const newExplored = nodesExplored + 1;

      if (node.depth > deepestLevel) {
        newDeepest = node.depth;
      }

      setCurrentDepth(newDepth);
      setDeepestLevel(newDeepest);
      setNodesExplored(newExplored);

      // Walk upward from the clicked node and keep only a small amount of context.
      const SEARCH_DEPTH = 4;
      const nodesById = new Map(data.nodes.map((n) => [n.id, n]));
      const path: string[] = [node.name];
      let currentId = node.id;

      while (path.length < SEARCH_DEPTH) {
        const parentLink = data.links.find(
          (link) => getLinkNodeId(link.target) === currentId,
        );

        if (parentLink === undefined) {
          break;
        }

        const parentId = getLinkNodeId(parentLink.source);
        const parentNode = nodesById.get(parentId);

        if (parentNode === undefined) {
          break;
        }

        path.push(parentNode.name);
        currentId = parentId;
      }

      const searchQuery = path.join(", ");

      let result: ExpansionResponse | null = null;
      // Refactor to tanstack
      const response = await fetch("/api/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: node.name, searchQuery, }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error:", response.status, errorText);
        toast("Slow Down!!! You've been rate limited")
        nodeStatesRef.current[node.id] = 'idle';
        return;
      }

      result = await response.json();

      if (result) {
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

          fan();
          
          handleGraphSave({
            nodes: [...prev.nodes, ...newNodes],
            links: [...prev.links, ...newLinks],
          }, {
            currentDepth: newDepth,
            nodesExplored: newExplored,
            deepestLevel: newDeepest
          });
          return {
            nodes: [...prev.nodes, ...newNodes],
            links: [...prev.links, ...newLinks],
          };
        });
      }

      nodeStatesRef.current[node.id] = 'idle';
    },
    [data.links, data.nodes],
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
        type: "top-level" as const,
      })),
      links: [],
    });
  };

  if (!user) {
    return;
  }

  const existingInterests = getUserInterests(user);

  if (!interestsSelected && !onboardingCompleted) {
    return (
      <InterestSelection user={user} onComplete={handleInterestsSelected} />
    );
  }

  if (!interestsSelected && onboardingCompleted) {
    handleInterestsSelected(existingInterests);
  }


  return (
    <div className={cn("min-h-screen w-full flex flex-col background-pattern")}>
      <div className="fixed top-0 left-0 p-2">
        <Navbar />
        <MetricPanel
          depthLevel={currentDepth}
          nodesExplored={nodesExplored}
          deepestLevel={deepestLevel}
        />
      </div>

      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        nodeAutoColorBy="group"
        nodeLabel={""}
        onNodeClick={handleNodeClick}
        width={window.innerWidth}
        height={window.innerHeight}
        onNodeHover={(node) => {
          if (!node) {
            hoveredNodeRef.current = null;
            return;
          }

          if ((node as Node).type !== "resource") {
            hoveredNodeRef.current = node as Node;
          }
        }}
        nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
          const label = node.name;
          const fontSize = 14 / globalScale;
          ctx.font = `${fontSize}px JetBrains Mono`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2,
          );

          const isResource = node.type === "resource";
          const isTopLevel = node.type === "top-level";
          const isLoading = nodeStatesRef.current[node.id] === "loading";
          const isHovered = hoveredNodeRef.current?.id === node.id;

          // Colour nodes based on states or type
          let nodeColor = "oklch(0.4176 0.0592 238.24)";

          if (isLoading) {
            nodeColor = "oklch(0.6765 0.0715 57.72)";
          } else if (isHovered) {
            nodeColor = "oklch(0.6941 0.1233 238.24)";
          } else if (isTopLevel) {
            nodeColor = "oklch(0.6941 0.1233 238.24)";
          } else if (isResource) {
            nodeColor = "oklch(0.7294 0.111 66.71)";
          } else if (hasChildren(node.id)) {
            nodeColor = "oklch(0.6941 0.1233 238.24)"
          }

          if (!isResource) {
            // Topic nodes
            ctx.beginPath();
            ctx.arc(node.x, node.y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = nodeColor;
            ctx.fill();
          } else {
            const radius = 3;
            const rectSize = radius * 2;
            const rectX = node.x - radius;
            const rectY = node.y - radius;

            ctx.beginPath();
            ctx.fillStyle = nodeColor;
            ctx.fill();

            if (!node.favicon) {
              // Create placeholder
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(
                rectX,
                rectY,
                radius,
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
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.clip();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                // ctx.filter = 'hue-rotate(185deg) saturate(1.15)';

                try {
                  ctx.drawImage(
                    cachedImage,
                    rectX,
                    rectY,
                    rectSize,
                    rectSize
                  );
                } catch { }

                ctx.restore();
              }
            }
          }
          // Render labels
          const showLabel = node.type !== "resource" && globalScale >= 2.5;

          if (showLabel) {
            ctx.fillStyle = "rgba(255, 255, 255, 0)";
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2 - 10,
              ...bckgDimensions,
            );

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'oklch(0.7735 0.0962 57.72)';
            ctx.fillText(label, node.x, node.y - 5);
          }

          node.__bckgDimensions = bckgDimensions;
        }}
        nodePointerAreaPaint={(node: any, color: any, ctx: any) => {
          ctx.fillStyle = color;

          if (node.type === "resource") {
            const rectSize = 6;
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
        d3VelocityDecay={0.8} // default 0.4, lower = nodes travel further
        linkDirectionalArrowLength={0}
        linkDirectionalArrowRelPos={1}
        linkColor={() => "oklch(0.7176 0.0691 57.72)"}
      />
    </div>
  );
}
