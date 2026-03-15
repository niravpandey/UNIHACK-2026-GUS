"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./app.module.css";
import { Search, Plus } from "lucide-react";
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

const HIGH_LEVEL_CATEGORIES = [
  "Computer Science",
  "Cooking",
  "Music",
  "Sports",
  "Mathematics",
  "Art",
  "Literature",
  "Science",
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState(false);
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

      let result: ExpansionResponse | null = null;
      // Refactor to tanstack
      const response = await fetch("/api/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: node.name }),
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
    [data.links],
  );

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

  function hasChildren(nodeId: number) {
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
    <div className={cn("min-h-screen w-full relative flex flex-col background-pattern")}>
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
            ctx.fillStyle = "rgba(255, 255, 255, 0)";
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2 - 10,
              ...bckgDimensions,
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
        d3VelocityDecay={0.6} // default 0.4, lower = nodes travel further
        linkDirectionalArrowLength={0}
        linkDirectionalArrowRelPos={1}
        linkColor={() => "oklch(0.7176 0.0691 57.72)"}
      />
    </div>
  );
}
