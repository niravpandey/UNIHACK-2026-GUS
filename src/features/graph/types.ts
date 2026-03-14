import type { Database } from "@/supabase/database.types";

type GraphRow = Database['public']['Tables']['graphs']['Row']

// Override just the jsonb column
export type Graph = Omit<GraphRow, 'graph_data'> & {
  graph_data: GraphData
}

export type Node = {
  id: number;
  name: string;
  group: number;
  depth: number;
}

export type Link = {
  source: number | Node;
  target: number | Node;
}

export type GraphData = {
  nodes: Node[];
  links: Link[];
}