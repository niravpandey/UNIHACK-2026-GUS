import type { Database } from "@/supabase/database.types";

type GraphRow = Database["public"]["Tables"]["graphs"]["Row"];

// Override just the jsonb column
export type Graph = Omit<GraphRow, "graph_data"> & {
  graph_data: GraphData;
};

export type Node = {
  id: number;
  name: string;
  group: number;
  depth: number;
  type?: "topic" | "resource";
  url?: string;
  source?: "web" | "youtube" | "wiki";
  favicon?: string;
  snippet?: string;
};

export type TopicNode = Node & {
  type: "topic";
};

export type ResourceNode = Node & {
  type: "resource";
  url: string;
  source?: "web" | "youtube" | "wiki";
  favicon?: string;
  snippet?: string;
};

export type Link = {
  source: number | Node;
  target: number | Node;
};

export type GraphData = {
  nodes: Node[];
  links: Link[];
};
