import DynamicGroupNode from '@/components/nodes/loops/DynamicGroupNode'
import { FlowWorkflowNodeTypesByCategory } from '@/store/nodeTypesSlice'
import { CreateNodeResult, FlowWorkflowNode } from '@/types/api_types/nodeTypeSchemas'
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    NodeTypes,
    OnConnect,
    OnEdgesChange,
    OnNodesChange,
    ReactFlowInstance,
    getConnectedEdges,
} from '@xyflow/react'
import isEqual from 'lodash/isEqual'
import { useTheme } from 'next-themes'
import { useCallback, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import DynamicNode from '../components/nodes/DynamicNode'
import InputNode from '../components/nodes/InputNode'
import { CoalesceNode } from '../components/nodes/logic/CoalesceNode'
import { RouterNode } from '../components/nodes/logic/RouterNode'
import { createDynamicGroupNodeWithChildren } from '../components/nodes/loops/groupNodeUtils'
import {
    addNodeWithConfig,
    connect,
    deleteEdge,
    deleteNode as deleteNodeAction,
    edgesChange,
    nodesChange,
    setEdges,
    setSelectedNode,
} from '../store/flowSlice'
import { AppDispatch, RootState } from '../store/store'
import { createNode } from './nodeFactory'

interface UseNodeTypesOptions {
    nodeTypesConfig: FlowWorkflowNodeTypesByCategory | undefined
    readOnly?: boolean
    includeCoalesceNode?: boolean
}

export const useNodeTypes = ({
    nodeTypesConfig,
    readOnly = false,
    includeCoalesceNode = false,
}: UseNodeTypesOptions) => {
    const nodeTypes = useMemo<NodeTypes>(() => {
        if (!nodeTypesConfig) return {}

        const types: NodeTypes = {}
        Object.keys(nodeTypesConfig).forEach((category) => {
            nodeTypesConfig[category].forEach((node) => {
                if (node.name === 'InputNode') {
                    types[node.name] = (props: any) => <InputNode key={props.id} {...props} readOnly={readOnly} />
                } else if (node.name === 'RouterNode') {
                    types[node.name] = (props: any) => <RouterNode key={props.id} {...props} readOnly={readOnly} />
                } else if (includeCoalesceNode && node.name === 'CoalesceNode') {
                    types[node.name] = CoalesceNode
                } else if (node.name === 'ForLoopNode') {
                    types[node.name] = (props: any) => <DynamicGroupNode key={props.id} {...props} />
                } else {
                    types[node.name] = (props: any) => (
                        <DynamicNode
                            key={props.id}
                            {...props}
                            type={node.name}
                            displayOutput={true}
                            readOnly={readOnly}
                        />
                    )
                }
            })
        })
        return types
    }, [nodeTypesConfig, readOnly, includeCoalesceNode])

    const isLoading = !nodeTypesConfig
    return { nodeTypes, isLoading }
}

export const getNodeTitle = (data: FlowWorkflowNode['data']): string => {
    return data?.config?.title || data?.title || data?.type || 'Untitled'
}

const generateNewNodeId = (nodes: FlowWorkflowNode[], nodeType: string): string => {
    const existingIds = nodes.map((node) => node.id)
    const sanitizedType = nodeType.replace(/\s+/g, '_')
    let counter = 1
    let newId = `${sanitizedType}_${counter}`

    while (existingIds.includes(newId)) {
        counter++
        newId = `${sanitizedType}_${counter}`
    }

    return newId
}

export const createNodeAtCenter = (
    nodes: FlowWorkflowNode[],
    nodeTypes: FlowWorkflowNodeTypesByCategory,
    nodeType: string,
    reactFlowInstance: ReactFlowInstance,
    dispatch: AppDispatch
): void => {
    const id = generateNewNodeId(nodes, nodeType)
    const center = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
    })

    const position = {
        x: center.x,
        y: center.y,
    }

    // If this is a dynamic group node, handle it specially
    if (nodeType === 'ForLoopNode') {
        const created = createDynamicGroupNodeWithChildren(nodeTypes, nodeType, id, position, dispatch)
        if (created) return
    }

    // Otherwise create a normal node
    const result = createNode(nodeTypes, nodeType, id, position)
    if (result) {
        dispatch(addNodeWithConfig(result))
    }
}

export const duplicateNode = (nodeId: string, dispatch: AppDispatch, getState: () => RootState): void => {
    const state = getState()
    const nodes = state.flow.nodes
    const edges = state.flow.edges

    const sourceNode = nodes.find((node) => node.id === nodeId)
    if (!sourceNode || !sourceNode.data) {
        console.error('Node not found or invalid data')
        return
    }

    // Get all edges connected to the current node
    const connectedEdges = getConnectedEdges(
        [
            {
                id: nodeId,
                position: sourceNode.position,
                data: sourceNode.data,
            },
        ],
        edges
    )

    // Generate a new unique ID for the duplicated node using the existing function
    const newNodeId = generateNewNodeId(nodes, sourceNode.type || 'default')

    // Create the new node with an offset position
    const newNode = {
        ...sourceNode,
        id: newNodeId,
        position: {
            x: sourceNode.position.x + 20,
            y: sourceNode.position.y + 20,
        },
        data: {
            ...sourceNode.data,
            title: newNodeId, // Update the title in node data
        },
        selected: false,
    }

    // Get the source node's config from the Redux store
    const sourceNodeConfig = state.flow.nodeConfigs[nodeId]
    if (!sourceNodeConfig) {
        console.error('Node config not found')
        return
    }

    // Create the node config result with a deep copy of the source config
    const nodeConfig: CreateNodeResult = {
        node: newNode,
        config: {
            ...sourceNodeConfig,
            title: newNodeId, // Update the title in config
        },
    }

    // Check if this node has any children
    const childNodes = nodes.filter((node) => node.parentId === nodeId)

    if (childNodes.length > 0) {
        // Find all edges between children
        const childEdges = edges.filter((edge) =>
            childNodes.some((child) => child.id === edge.source || child.id === edge.target)
        )

        // Create new nodes and edges for each child
        const newChildNodes: FlowWorkflowNode[] = []
        const newChildEdges: Edge[] = []
        const idMapping: Record<string, string> = { [nodeId]: newNodeId }

        // Add the parent node first
        dispatch(addNodeWithConfig(nodeConfig))

        // Duplicate each child node
        childNodes.forEach((childNode) => {
            const newChildId = generateNewNodeId(nodes, childNode.type || 'default')
            idMapping[childNode.id] = newChildId

            const newChildNode = {
                ...childNode,
                id: newChildId,
                parentId: newNodeId,
                data: {
                    ...childNode.data,
                    title: newChildId,
                },
                selected: false,
            }
            newChildNodes.push(newChildNode)

            // Add config for the new child node
            const childConfig = state.flow.nodeConfigs[childNode.id]
            if (childConfig) {
                dispatch(
                    addNodeWithConfig({
                        node: newChildNode,
                        config: {
                            ...childConfig,
                            title: newChildId,
                        },
                    })
                )
            }
        })

        // Duplicate internal edges between children
        childEdges.forEach((edge) => {
            const newEdgeId = uuidv4()
            const newSourceId = idMapping[edge.source]
            const newTargetId = idMapping[edge.target]

            if (newSourceId && newTargetId) {
                newChildEdges.push({
                    ...edge,
                    id: newEdgeId,
                    source: newSourceId,
                    target: newTargetId,
                    sourceHandle: edge.sourceHandle,
                    targetHandle: edge.targetHandle,
                })
            }
        })

        // Add all the new edges
        dispatch(setEdges({ edges: [...edges, ...newChildEdges] }))
    } else {
        // For nodes without children, just duplicate the node and its edges
        const newEdges = connectedEdges.map((edge) => {
            const newEdgeId = uuidv4()
            return {
                ...edge,
                id: newEdgeId,
                source: edge.source === nodeId ? newNodeId : edge.source,
                target: edge.target === nodeId ? newNodeId : edge.target,
            }
        })

        // Dispatch actions to add the new node and edges
        dispatch(addNodeWithConfig(nodeConfig))
        dispatch(setEdges({ edges: [...edges, ...newEdges] }))
    }
}

export const insertNodeBetweenNodes = (
    nodes: FlowWorkflowNode[],
    nodeTypes: FlowWorkflowNodeTypesByCategory,
    nodeType: string,
    sourceNode: FlowWorkflowNode,
    targetNode: FlowWorkflowNode,
    edgeId: string,
    dispatch: AppDispatch,
    onComplete?: () => void
): void => {
    if (!sourceNode?.position || !targetNode?.position) {
        console.error('Invalid source or target node position')
        return
    }

    const id = generateNewNodeId(nodes, nodeType)
    const newPosition = {
        x: (sourceNode.position.x + targetNode.position.x) / 2,
        y: (sourceNode.position.y + targetNode.position.y) / 2,
    }

    // Create the new node
    const result = createNode(nodeTypes, nodeType, id, newPosition)
    if (!result) {
        console.error('Failed to create node')
        return
    }

    // First delete the existing edge
    dispatch(deleteEdge({ edgeId }))

    // Then add the new node with its config
    dispatch(addNodeWithConfig(result))

    // Create source -> new node connection
    dispatch(
        connect({
            connection: {
                source: sourceNode.id,
                target: id,
                sourceHandle: sourceNode.id,
                targetHandle: sourceNode.id,
            },
        })
    )

    // Create new node -> target connection
    dispatch(
        connect({
            connection: {
                source: id,
                target: targetNode.id,
                sourceHandle: id,
                targetHandle: id,
            },
        })
    )

    onComplete?.()
}

export const nodeComparator = (prevNode: FlowWorkflowNode, nextNode: FlowWorkflowNode) => {
    if (!prevNode || !nextNode) return false
    // Skip position and measured properties when comparing nodes
    const { position: prevPosition, measured: prevMeasured, ...prevRest } = prevNode
    const { position: nextPosition, measured: nextMeasured, ...nextRest } = nextNode
    return isEqual(prevRest, nextRest)
}

interface StyledEdgesOptions {
    edges: Edge[]
    hoveredNode: string | null
    hoveredEdge: string | null
    selectedEdgeId: string | null
    handlePopoverOpen?: (params: { sourceNode: Node; targetNode: Node; edgeId: string }) => void
    readOnly?: boolean
}

export const useStyledEdges = ({
    edges,
    hoveredNode,
    hoveredEdge,
    selectedEdgeId,
    handlePopoverOpen,
    readOnly = false,
}: StyledEdgesOptions) => {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    return useMemo(() => {
        return edges.map((edge) => ({
            ...edge,
            type: 'custom',
            style: {
                stroke: readOnly
                    ? edge.id === hoveredEdge || edge.id === selectedEdgeId
                        ? isDark
                            ? '#fff'
                            : '#000'
                        : edge.source === hoveredNode || edge.target === hoveredNode
                          ? isDark
                              ? '#fff'
                              : '#000'
                          : isDark
                            ? '#888'
                            : '#555'
                    : hoveredEdge === edge.id ||
                        edge.id === selectedEdgeId ||
                        hoveredNode === edge.source ||
                        hoveredNode === edge.target
                      ? isDark
                          ? '#fff'
                          : '#555'
                      : isDark
                        ? '#666'
                        : '#999',
                strokeWidth: readOnly
                    ? edge.id === hoveredEdge || edge.id === selectedEdgeId
                        ? 4
                        : edge.source === hoveredNode || edge.target === hoveredNode
                          ? 4
                          : 2
                    : hoveredEdge === edge.id ||
                        edge.id === selectedEdgeId ||
                        hoveredNode === edge.source ||
                        hoveredNode === edge.target
                      ? 3
                      : 1.5,
            },
            data: {
                ...edge.data,
                showPlusButton: edge.id === hoveredEdge || edge.id === selectedEdgeId,
                onPopoverOpen: handlePopoverOpen,
            },
            key: edge.id,
        }))
    }, [edges, hoveredNode, hoveredEdge, selectedEdgeId, handlePopoverOpen, readOnly, isDark])
}

interface NodesWithModeOptions {
    nodes: Node[]
    mode: 'pointer' | 'hand'
}

export const useNodesWithMode = ({ nodes, mode }: NodesWithModeOptions) => {
    return useMemo(() => {
        return nodes.filter(Boolean).map((node) => ({
            ...node,
            draggable: true,
            selectable: mode === 'pointer',
            position: node?.position,
            type: node?.type,
            data: node?.data,
        }))
    }, [nodes, mode])
}

interface useAdjustGroupNodesZIndexOptions {
    nodes: Node[]
}

export const useAdjustGroupNodesZIndex = ({ nodes }: useAdjustGroupNodesZIndexOptions) => {
    return useMemo(() => {
        let groupNodeZIndex = -1
        const updatedNodes = nodes.map((node) => {
            if (node.type === 'ForLoopNode') {
                return {
                    ...node,
                    style: {
                        ...node.style,
                        zIndex: groupNodeZIndex,
                    },
                }
            }
            return node
        })
        return updatedNodes
    }, [nodes])
}

interface FlowEventHandlersOptions {
    dispatch: AppDispatch
    nodes: Node[]
    setHelperLines?: (lines: { horizontal: number | null; vertical: number | null }) => void
}

export const useFlowEventHandlers = ({ dispatch, nodes, setHelperLines }: FlowEventHandlersOptions) => {
    // Create throttled position handler
    const throttledPosition = useMemo(() => createThrottledPositionChange(), [])

    const onNodesChange: OnNodesChange = useCallback(
        (changes: NodeChange[]) => {
            // Clear helper lines if not a position change
            if (!changes.some((c) => c.type === 'position')) {
                setHelperLines?.({ horizontal: null, vertical: null })
                dispatch(nodesChange({ changes }))
                return
            }

            // Handle position changes with throttling
            const positionChanges = changes.filter(c => c.type === 'position')
            const otherChanges = changes.filter(c => c.type !== 'position')

            // Immediately dispatch non-position changes
            if (otherChanges.length > 0) {
                dispatch(nodesChange({ changes: otherChanges }))
            }

            // Throttle position changes
            if (positionChanges.length > 0) {
                throttledPosition.handlePositionChange(positionChanges, dispatch)
            }
        },
        [dispatch, nodes, setHelperLines, throttledPosition]
    )

    // Handle drag end to flush any pending position changes
    const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
        throttledPosition.flushChanges(dispatch)
    }, [dispatch, throttledPosition])

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes: EdgeChange[]) => dispatch(edgesChange({ changes })),
        [dispatch]
    )

    const onConnect: OnConnect = useCallback(
        (connection: Connection) => {
            if (!connection.targetHandle || connection.targetHandle === 'node-body') {
                const sourceNode = nodes.find((n) => n.id === connection.source)
                const targetNode = nodes.find((n) => n.id === connection.target)

                if (sourceNode && targetNode) {
                    const outputHandleName = connection.sourceHandle

                    if (!outputHandleName) {
                        console.error('Source handle is not specified.')
                        return
                    }

                    connection = {
                        ...connection,
                        targetHandle: outputHandleName,
                    }
                }
            }

            const sourceNode = nodes.find((n) => n.id === connection.source)
            if (sourceNode?.type === 'RouterNode') {
                connection = {
                    ...connection,
                    targetHandle: connection.source + '.' + connection.sourceHandle,
                }
            } else {
                connection = {
                    ...connection,
                    targetHandle: connection.sourceHandle,
                }
            }

            dispatch(connect({ connection }))
        },
        [dispatch, nodes]
    )

    return {
        onNodesChange,
        onEdgesChange,
        onConnect,
        onNodeDragStop
    }
}

export const deleteNode = (nodeId: string, selectedNodeId: string | null, dispatch: AppDispatch): void => {
    dispatch(deleteNodeAction({ nodeId }))
    if (selectedNodeId === nodeId) {
        dispatch(setSelectedNode({ nodeId: null }))
    }
}

export const getPredecessorFields = (nodeId: string, nodes: FlowWorkflowNode[], edges: Edge[]): string[] => {
    // Find all incoming edges to this node
    const incomingEdges = edges.filter((edge) => edge.target === nodeId)

    // Get all predecessor nodes
    const predecessorNodes = incomingEdges
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .filter((node): node is FlowWorkflowNode => node !== undefined)

    // Generate field options using dot notation
    const fields: string[] = []
    predecessorNodes.forEach((node) => {
        const nodeTitle = getNodeTitle(node.data)
        // Get output schema from node's data or config
        const outputSchema = node.data?.config?.output_schema || node.data?.output_schema || []

        // Add each field with dot notation
        outputSchema.forEach((field: { name: string }) => {
            fields.push(`${nodeTitle}.${field.name}`)
        })
    })

    return fields.sort()
}

// Add throttled position update utilities
export const createThrottledPositionChange = () => {
    let lastUpdate = 0
    const throttleInterval = 16 // Reduced to 16ms (roughly 60fps) for more responsive updates
    let pendingChanges: NodeChange[] = []
    let animationFrame: number | null = null

    return {
        handlePositionChange: (changes: NodeChange[], dispatch: AppDispatch) => {
            const now = Date.now()

            // Always collect changes
            pendingChanges = [...pendingChanges, ...changes]

            // If animation frame is already scheduled, don't schedule another one
            if (animationFrame !== null) {
                return
            }

            // If enough time has passed, schedule update on next animation frame
            if (now - lastUpdate >= throttleInterval) {
                animationFrame = requestAnimationFrame(() => {
                    // Only take the latest position for each node
                    const latestPositions = new Map<string, NodeChange>()
                    pendingChanges.forEach(change => {
                        if (change.type === 'position' && change.id) {
                            latestPositions.set(change.id, change)
                        }
                    })

                    const optimizedChanges = [...latestPositions.values()]
                    dispatch(nodesChange({ changes: optimizedChanges }))
                    pendingChanges = []
                    lastUpdate = now
                    animationFrame = null
                })
            }
        },

        flushChanges: (dispatch: AppDispatch) => {
            // Cancel any pending animation frame
            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame)
                animationFrame = null
            }

            if (pendingChanges.length > 0) {
                // Optimize final update
                const latestPositions = new Map<string, NodeChange>()
                pendingChanges.forEach(change => {
                    if (change.type === 'position' && change.id) {
                        latestPositions.set(change.id, change)
                    }
                })

                const optimizedChanges = [...latestPositions.values()]
                dispatch(nodesChange({ changes: optimizedChanges }))
                pendingChanges = []
                lastUpdate = Date.now()
            }
        }
    }
}
