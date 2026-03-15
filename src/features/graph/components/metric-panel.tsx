interface MetricPanelProps {
  depthLevel: number;
  nodesExplored: number;
  deepestLevel: number;
}

export default function MetricPanel({ depthLevel, nodesExplored, deepestLevel }: MetricPanelProps) {
  return (
    <div className="p-2 w-fit font-bold font-jet">
      <p>Depth Level: {depthLevel}</p>
      <p>Nodes Explored: {nodesExplored}</p>
      <p>Deepest Depth Travelled: {deepestLevel}</p>
    </div>
  )
}


