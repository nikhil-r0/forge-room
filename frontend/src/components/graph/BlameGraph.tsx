"use client"

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "reactflow"
import type { NodeTypes, Node, Edge } from "reactflow"
import "reactflow/dist/style.css"
import { useEffect, useMemo } from "react"
import type { BlameNode, BlameEdge } from "@/lib/types"
import { GitBranch } from "lucide-react"

// ─── Risk Color Mapping ───

const riskColor = (score: number) => {
  if (score <= 3) return "#22c55e"
  if (score <= 6) return "#eab308"
  return "#ef4444"
}

// ─── Custom Decision Node ───

function DecisionNode({ data }: { data: BlameNode }) {
  return (
    <div
      className="px-3 py-2 rounded-lg border-2 text-xs font-mono max-w-[160px] shadow-lg"
      style={{
        borderColor: riskColor(data.risk_score),
        background: "#0f172a",
        color: "#f1f5f9",
        boxShadow: `0 0 12px ${riskColor(data.risk_score)}30`,
      }}
    >
      <div className="text-[10px] uppercase tracking-widest opacity-60 mb-1">
        {data.category}
      </div>
      <div className="leading-tight">{data.label}</div>
      <div
        className="mt-1 text-[10px] font-bold"
        style={{ color: riskColor(data.risk_score) }}
      >
        risk: {data.risk_score.toFixed(1)}/10
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = { decision: DecisionNode }

// ─── Component ───

interface BlameGraphProps {
  rawNodes: BlameNode[]
  rawEdges: BlameEdge[]
}

export default function BlameGraph({ rawNodes, rawEdges }: BlameGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    const laidNodes: Node[] = rawNodes.map((n, i) => ({
      id: n.id,
      type: "decision",
      position: { x: (i % 3) * 220 + 40, y: Math.floor(i / 3) * 140 + 40 },
      data: n,
      className: n.is_new ? "animate-pulse" : "",
    }))

    const laidEdges: Edge[] = rawEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: e.type === "contradicts",
      style: {
        stroke: e.type === "contradicts" ? "#ef4444" : "#22c55e",
        strokeDasharray: e.type === "contradicts" ? "5,5" : undefined,
        strokeWidth: 2,
      },
      label: e.type === "contradicts" ? "⚠ contradicts" : "depends on",
      labelStyle: {
        fill: e.type === "contradicts" ? "#ef4444" : "#22c55e",
        fontSize: 10,
      },
    }))

    setNodes(laidNodes)
    setEdges(laidEdges)
  }, [rawNodes, rawEdges, setNodes, setEdges])

  // Empty state
  if (rawNodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
        <div className="p-4 rounded-lg border border-dashed border-outline-variant">
          <GitBranch className="w-8 h-8 text-on-surface-variant" />
        </div>
        <div className="text-center">
          <p className="text-label-sm uppercase tracking-widest text-on-surface-variant font-semibold">
            No Decisions Yet
          </p>
          <p className="text-[10px] text-outline-variant mt-1 max-w-[160px]">
            Architectural decisions will appear here as the team discusses.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-surface-dim rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-surface-dim"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
        <Controls className="!bg-surface-container !border-surface-container-high !shadow-lg [&>button]:!bg-surface-container [&>button]:!border-surface-container-high [&>button]:!text-on-surface-variant" />
        <MiniMap
          nodeColor={(n) => riskColor(n.data?.risk_score ?? 0)}
          className="!bg-surface-container-low !border !border-surface-container-high"
          maskColor="rgba(15, 23, 42, 0.7)"
        />
      </ReactFlow>
    </div>
  )
}
