import { useCallback, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { updateWorkflow } from '../utils/api'
import { RootState } from '../store/store'
import { debounce } from 'lodash'
import { WorkflowCreateRequest, WorkflowNode } from '@/types/api_types/workflowSchemas'
import { FlowWorkflowEdge as Edge } from '@/types/api_types/nodeTypeSchemas'

export const useSaveWorkflow = () => {
    const nodes = useSelector((state: RootState) => state.flow.nodes)
    const edges = useSelector((state: RootState) => state.flow.edges)
    const nodeConfigs = useSelector((state: RootState) => state.flow.nodeConfigs)
    const workflowID = useSelector((state: RootState) => state.flow.workflowID)
    const workflowInputVariables = useSelector((state: RootState) => state.flow.workflowInputVariables)
    const workflowName = useSelector((state: RootState) => state.flow.projectName)
    const testInputs = useSelector((state: RootState) => state.flow.testInputs)

    // Create a ref to store the current values
    const valuesRef = useRef({
        nodes,
        edges,
        nodeConfigs,
        workflowID,
        workflowInputVariables,
        workflowName,
        testInputs,
    })

    // Update the ref when values change
    useEffect(() => {
        valuesRef.current = {
            nodes,
            edges,
            nodeConfigs,
            workflowID,
            workflowInputVariables,
            workflowName,
            testInputs,
        }
    }, [nodes, edges, nodeConfigs, workflowID, workflowInputVariables, workflowName, testInputs])

    // Create the debounced save function once
    const debouncedSave = useRef(
        debounce(async () => {
            const { nodes, edges, nodeConfigs, workflowID, workflowName, testInputs } = valuesRef.current

            try {
                const updatedNodes = nodes
                    .filter((node): node is NonNullable<typeof node> => node !== null && node !== undefined)
                    .map((node) => {
                        const config = nodeConfigs[node.id] || {}
                        const title = config.title || node.data.title

                        // Ensure the RouterNode structure uses route_map
                        if (node.type === 'RouterNode') {
                            return {
                                ...node,
                                config: {
                                    ...config,
                                    route_map: config.route_map || {}, // Ensure route_map exists
                                },
                                title,
                                parent_id: node.parentId || null,
                                dimensions: node.measured,
                            }
                        }

                        return {
                            ...node,
                            config,
                            title,
                            parent_id: node.parentId || null,
                            dimensions: node.type === 'ForLoopNode' ? node.measured : undefined,
                        }
                    })

                const updatedWorkflow: WorkflowCreateRequest = {
                    name: workflowName,
                    description: '',
                    definition: {
                        nodes: updatedNodes.map(
                            (node) =>
                                ({
                                    id: node.id,
                                    title: node.title,
                                    node_type: node.type,
                                    config: node.config,
                                    coordinates: node.position,
                                    parent_id: node.parent_id || null,
                                    dimensions: node.dimensions,
                                }) as WorkflowNode
                        ),
                        links: edges.map((edge: Edge) => {
                            const sourceNode = updatedNodes.find((node) => node?.id === edge.source)
                            const targetNode = updatedNodes.find((node) => node?.id === edge.target)

                            if (sourceNode?.type === 'RouterNode') {
                                return {
                                    source_id: sourceNode?.id || '',
                                    target_id: targetNode?.id || '',
                                    source_handle: edge.sourceHandle,
                                    target_handle: edge.targetHandle,
                                }
                            } else {
                                return {
                                    source_id: sourceNode?.id || '',
                                    target_id: targetNode?.id || '',
                                }
                            }
                        }),
                        test_inputs: testInputs,
                    },
                }

                await updateWorkflow(workflowID, updatedWorkflow)
            } catch (error) {
                throw error
            }
        }, 1000)
    ).current

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            debouncedSave.cancel()
        }
    }, [debouncedSave])

    // Return a stable callback that triggers the debounced save
    return useCallback(() => {
        debouncedSave()
    }, [debouncedSave])
}
