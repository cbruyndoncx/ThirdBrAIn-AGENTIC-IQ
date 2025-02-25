import { Position, FlowWorkflowNodeConfig, FlowWorkflowNode, FlowWorkflowNodeType } from '@/types/api_types/nodeTypeSchemas';
import { FlowWorkflowNodeTypesByCategory } from '@/store/nodeTypesSlice'
import cloneDeep from 'lodash/cloneDeep'

// Function to create a node based on its type
export const createNode = (
    nodeTypes: FlowWorkflowNodeTypesByCategory,
    type: string,
    id: string,
    position: Position,
    parentId: string | null = null,
    dimensions: { width: number; height: number } | null = null,
    title: string | null = null,
): { node: FlowWorkflowNode; config: FlowWorkflowNodeConfig } | null => {
    let nodeType: FlowWorkflowNodeType | null = null
    for (const category in nodeTypes) {
        const found = nodeTypes[category].find((node) => node.name === type)
        if (found && 'input' in found && 'output' in found) {
            nodeType = found as FlowWorkflowNodeType
            break
        }
    }
    if (!nodeType) {
        return null
    }

    let config = cloneDeep(nodeType.config)
    config = {
        ...config,
        title: title || id,
    }
    const extent = parentId ? 'parent' : undefined
    const expandParent = parentId ? true : undefined

    const node: FlowWorkflowNode = {
        id,
        type: nodeType.name,
        position,
        measured: dimensions,
        parentId,
        expandParent,
        extent,
        data: {
            title: title || id,
            acronym: nodeType.visual_tag.acronym,
            color: nodeType.visual_tag.color,
            logo: nodeType.logo,
            category: nodeType.category,
        },
        width: dimensions?.width,
        height: dimensions?.height,
    }
    return { node, config }
}
