import { useEffect, useCallback, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { addNode, setNodes } from '../store/flowSlice'
import { FlowWorkflowNode } from '@/types/api_types/nodeTypeSchemas'
import { createNode } from '../utils/nodeFactory'
import { AppDispatch } from '../store/store' // Import AppDispatch type
import { NodeTypes } from '@xyflow/react'
import { FlowWorkflowNodeTypesByCategory } from '@/store/nodeTypesSlice'

export const useKeyboardShortcuts = (
    selectedNodeID: string | null,
    nodes: FlowWorkflowNode[],
    nodeTypes: NodeTypes,
    nodeTypeConfig: FlowWorkflowNodeTypesByCategory,
    dispatch: AppDispatch,
    handleLayout?: () => void
) => {
    const [copiedNode, setCopiedNode] = useState<FlowWorkflowNode | null>(null)

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey) {
                switch (event.key) {
                    case 'c': // CMD + C or CTRL + C
                        if (selectedNodeID) {
                            const nodeToCopy = nodes.find((node) => node.id === selectedNodeID)
                            if (nodeToCopy) {
                                setCopiedNode(nodeToCopy)
                            }
                        }
                        break
                    case 'v': // CMD + V or CTRL + V
                        if (copiedNode) {
                            const newNode = createNode(nodeTypeConfig, copiedNode.type, uuidv4(), {
                                x: copiedNode.position.x + 50,
                                y: copiedNode.position.y + 50,
                            })
                            dispatch(addNode({ node: newNode.node }))
                        }
                        break
                    case 'i': // CMD + I or CTRL + I
                        if (handleLayout) {
                            event.preventDefault()
                            handleLayout()
                        }
                        break
                    default:
                        break
                }
            }
        },
        [selectedNodeID, copiedNode, nodes, dispatch, handleLayout]
    )

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [handleKeyDown])

    return { copiedNode, setCopiedNode }
}
