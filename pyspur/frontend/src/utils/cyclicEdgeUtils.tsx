import { Node, Edge } from '@xyflow/react'

export const isTargetAncestorOfSource = (sourceId: string, targetId: string, nodes: Node[], edges: Edge[]): boolean => {
    if (!sourceId || !targetId) {
        return false
    }
    if (sourceId === targetId) {
        return true
    }

    // Find all outgoing edges from the target node
    const outgoingEdges = edges.filter((edge) => edge.source === targetId)
    if (outgoingEdges.length === 0) {
        return false
    }

    // Get all child nodes
    const childNodes = outgoingEdges.map((edge) => nodes.find((node) => node.id === edge.target)).filter(Boolean)
    if (childNodes.length === 0) {
        return false
    }

    // Check if any child node is the source node
    return childNodes.some((node) => isTargetAncestorOfSource(sourceId, node.id, nodes, edges))
}
