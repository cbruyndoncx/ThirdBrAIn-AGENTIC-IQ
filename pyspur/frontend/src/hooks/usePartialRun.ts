import { setRunModalOpen, updateNodeDataOnly, updateNodesFromPartialRun } from '@/store/flowSlice'
import { AppDispatch, RootState } from '@/store/store'
import { useState } from 'react'
import { useSelector } from 'react-redux'
import { runPartialWorkflow } from '../utils/api'

interface PartialRunResult {
    // Add specific result type properties based on your API response
    [key: string]: any
}

interface PartialRunError {
    message: string
    // Add other error properties as needed
    [key: string]: any
}

export interface PartialRunParams {
    workflowId: string
    nodeId: string
    initialInputs?: Record<string, any>
    partialOutputs: Record<string, any>
    rerunPredecessors: boolean
}

const usePartialRun = (dispatch: AppDispatch) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<PartialRunError | null>(null)
    const [result, setResult] = useState<PartialRunResult | null>(null)
    const selectedTestInputId = useSelector((state: RootState) => state.flow.selectedTestInputId)
    const testInputs = useSelector((state: RootState) => state.flow.testInputs)
    const nodes = useSelector((state: RootState) => state.flow.nodes)

    const executePartialRun = async ({
        workflowId,
        nodeId,
        initialInputs,
        partialOutputs,
        rerunPredecessors,
    }: PartialRunParams): Promise<PartialRunResult | undefined> => {
        setLoading(true)
        setError(null)

        try {
            // If no initialInputs provided, use the selected test input
            let effectiveInitialInputs = initialInputs
            if (!effectiveInitialInputs && testInputs.length > 0) {
                const testCase = testInputs.find((row) => row.id.toString() === selectedTestInputId) ?? testInputs[0]
                if (testCase) {
                    const { id, ...inputValues } = testCase
                    const inputNode = nodes.find((node) => node.type === 'InputNode')
                    if (inputNode?.id) {
                        effectiveInitialInputs = {
                            [inputNode.id]: inputValues,
                        }
                    }
                }
            }

            // If no effectiveInitialInputs and no test inputs, open the RunModal
            if (!effectiveInitialInputs && testInputs.length === 0) {
                dispatch(setRunModalOpen(true))
                return
            }

            const data = await runPartialWorkflow(
                workflowId,
                nodeId,
                effectiveInitialInputs || {},
                partialOutputs,
                rerunPredecessors
            )
            setResult(data)

            // Update nodes with their outputs using the action creator
            if (data) {
                dispatch(updateNodesFromPartialRun(data))
            }

            return data
        } catch (err) {
            console.error('Error during partial run:', err)
            dispatch(updateNodeDataOnly({ id: nodeId, data: { taskStatus: 'FAILED', error: err.message } }))
        } finally {
            setLoading(false)
        }
    }

    return { executePartialRun, loading, error, result }
}

export default usePartialRun
