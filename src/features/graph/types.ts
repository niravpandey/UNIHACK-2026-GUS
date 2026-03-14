import type { Database } from "@/supabase/database.types";

type GraphRow = Database['public']['Tables']['graphs']['Row']

// Override just the jsonb column
export type Graph = Omit<GraphRow, 'graph_data'> & {
  graph_data: GraphData
}

export type BaseNode = {
  id: number;
  name: string;
  group: number;
  depth: number;
}

export type TopicNode = BaseNode & {
  type: 'topic';
}

export type ResourceNode = BaseNode & {
  type: 'resource';
  url: string;
  source: 'news' | 'web' | 'docs' | 'video';
  favicon?: string;
  snippet?: string;
}
export type Node = TopicNode | ResourceNode;

export type Link = {
  source: number | Node;
  target: number | Node;
}

export type GraphData = {
  nodes: Node[];
  links: Link[];
}
