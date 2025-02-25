import { updateNodeConfigOnly } from '@/store/flowSlice'
import { RootState } from '@/store/store'
import { Divider } from '@heroui/react'
import {
    Handle,
    NodeResizer,
    Position,
    useConnection,
    useStore,
    useUpdateNodeInternals,
} from '@xyflow/react'
import isEqual from 'lodash/isEqual'
import React, { memo, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import BaseNode from '../BaseNode'
import styles from '../DynamicNode.module.css'
import { getRelativeNodesBounds } from './groupNodeUtils'
import { OutputHandleRow } from '../shared/OutputHandleRow'

export interface DynamicGroupNodeProps {
    id: string
}

const DynamicGroupNode: React.FC<DynamicGroupNodeProps> = ({ id }) => {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const dispatch = useDispatch()

    // Select node data and associated config (if any)
    const node = useSelector((state: RootState) => state.flow.nodes.find((n) => n.id === id))
    const nodeConfig = useSelector((state: RootState) => state.flow.nodeConfigs[id])
    const nodes = useSelector((state: RootState) => state.flow.nodes)
    const edges = useSelector((state: RootState) => state.flow.edges, isEqual)
    const nodeConfigs = useSelector((state: RootState) => state.flow.nodeConfigs)

    const updateNodeInternals = useUpdateNodeInternals()

    // Compute minimal dimensions from child nodes, if any.
    const { minWidth, minHeight } = useStore((store) => {
        const childNodes = Array.from(store.nodeLookup.values()).filter((n) => n.parentId === id)
        const rect = getRelativeNodesBounds(childNodes)
        return {
            minWidth: Math.max(200, rect.x + rect.width),
            minHeight: Math.max(100, rect.y + rect.height),
        }
    }, customIsEqual)

    // Determine selection state
    const selectedNodeId = useSelector((state: RootState) => state.flow.selectedNode)
    const isSelected = String(id) === String(selectedNodeId)

    // For connection in progress
    const connection = useConnection()

    // Compute predecessor nodes for handles (nodes that connect into this group)
    const [predecessorNodes, setPredecessorNodes] = useState(() => {
        return edges
            .filter((edge) => edge.target === id)
            .map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source)
                return sourceNode ? sourceNode : null
            })
            .filter(Boolean)
    })

    const finalPredecessors = useMemo(() => {
        const updatedPredecessors = edges
            .filter((edge) => edge.target === id)
            .map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source)
                return sourceNode ? sourceNode : null
            })
            .filter(Boolean)

        let result = updatedPredecessors

        if (connection.inProgress && connection.toNode && connection.toNode.id === id) {
            const fromNodeParentId = connection.fromNode?.parentId
            const toNodeParentId = connection.toNode?.parentId
            const canConnect = fromNodeParentId === toNodeParentId
            if (
                canConnect &&
                connection.fromNode &&
                !updatedPredecessors.find((node: any) => node.id === connection.fromNode.id)
            ) {
                result = [...updatedPredecessors, connection.fromNode]
            }
        }
        return result.filter(
            (node: any, index: number, self: any[]) => self.findIndex((n) => n.id === node.id) === index
        )
    }, [edges, nodes, connection, id])

    useEffect(() => {
        const hasChanged =
            finalPredecessors.length !== predecessorNodes.length ||
            finalPredecessors.some((newNode, i) => !isEqual(newNode, predecessorNodes[i]))
        if (hasChanged) {
            setPredecessorNodes(finalPredecessors)
            updateNodeInternals(id)
        }
    }, [finalPredecessors, predecessorNodes, id, updateNodeInternals])

    // Keep input node's output schema in sync with parent's input_map
    useEffect(() => {
        // Find the input node by type and parent relationship
        const inputNode = nodes.find((n) => n.type === 'InputNode' && n.parentId === id)
        if (inputNode && nodeConfig?.input_map) {
            // Build output schema by looking up the actual types from source nodes
            const derivedSchema: Record<string, string> = {}

            Object.entries(nodeConfig.input_map).forEach(([key, sourceField]) => {
                // sourceField should be in format "node-title.field-name"
                const [sourceNodeTitle, fieldName] = String(sourceField).split('.')
                if (sourceNodeTitle && fieldName) {
                    // Find the source node by its title
                    const sourceNode = nodes.find((n) => n.data?.title === sourceNodeTitle)
                    if (sourceNode) {
                        // Get the source node's output schema
                        const sourceNodeConfig = nodeConfigs[sourceNode.id]
                        const sourceSchema = sourceNodeConfig?.output_schema
                        if (sourceSchema && fieldName in sourceSchema) {
                            // Use the type from the source node's output schema
                            derivedSchema[key] = sourceSchema[fieldName]
                        }
                    }
                }
            })

            // Only update if the schema has actually changed
            const inputNodeConfig = nodeConfigs[inputNode.id]
            if (!isEqual(inputNodeConfig?.output_schema, derivedSchema)) {
                dispatch(
                    updateNodeConfigOnly({
                        id: inputNode.id,
                        data: {
                            output_schema: derivedSchema,
                            has_fixed_output: true,
                        },
                    })
                )
            }
        }
    }, [id, nodeConfig?.input_map, nodes, nodeConfigs, dispatch])

    // Handlers for Input and Output handle rows
    interface HandleRowProps {
        id: string
        keyName: string
    }

    const renderOutputHandles = () => {
        return (
            <div className={`${styles.handlesColumn} ${styles.outputHandlesColumn}`} id="output-handle">
                {nodeConfig?.title && <OutputHandleRow id={id} keyName={String(nodeConfig?.title)} isCollapsed={isCollapsed} />}
            </div>
        )
    }

    return (
        <div className="w-full h-full relative">
            <NodeResizer
                nodeId={id}
                isVisible={true}
                minWidth={minWidth}
                minHeight={minHeight}
                lineStyle={{ borderColor: 'rgb(148 163 184)', display: 'none' }}
                handleStyle={{ backgroundColor: 'rgb(148 163 184)', width: '1rem', height: '1rem', borderRadius: 2 }}
            />
            <BaseNode
                id={id}
                data={node?.data}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                positionAbsoluteX={0}
                positionAbsoluteY={0}
                className={`group ${isSelected ? 'selected' : ''}`}
                isResizable={true}
                handleOpenModal={() => {}}
                renderOutputHandles={renderOutputHandles}
            >
                <div className={`h-full ${styles.nodeWrapper}`}>
                    {/* <div className="mt-2">{renderHandles()}</div> */}
                    <Divider className="mt-2" />
                    <div style={{ minHeight }} className="mt-2 bg-content2 dark:bg-content2/10 rounded-md h-full">
                        {/* Container that will expand for child nodes */}
                    </div>
                </div>
            </BaseNode>
        </div>
    )
}

function customIsEqual(
    prev: { minWidth: number; minHeight: number },
    next: { minWidth: number; minHeight: number }
): boolean {
    return prev.minWidth === next.minWidth && prev.minHeight === next.minHeight
}

export default memo(DynamicGroupNode)
