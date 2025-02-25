import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { initializeFlow } from '../store/flowSlice'
import { AlertState } from '../types/alert'

interface UseWorkflowFileOperationsProps {
  showAlert: (message: string, color: AlertState['color']) => void
}

interface WorkflowData {
  definition: any
  name: string
}

export const useWorkflowFileOperations = ({ showAlert }: UseWorkflowFileOperationsProps) => {
  const dispatch = useDispatch()
  const nodeTypesConfig = useSelector((state: RootState) => state.nodeTypes.data)
  const workflowId = useSelector((state: RootState) => state.flow.workflowID)

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const [pendingWorkflowData, setPendingWorkflowData] = useState<WorkflowData | null>(null)

  const handleConfirmOverwrite = () => {
    if (!pendingWorkflowData) return

    dispatch(
      initializeFlow({
        nodeTypes: nodeTypesConfig,
        definition: pendingWorkflowData.definition,
        workflowID: workflowId,
        name: pendingWorkflowData.name,
      })
    )

    showAlert('Workflow loaded successfully!', 'success')
    setPendingWorkflowData(null)
  }

  const handleFileUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const reader = new FileReader()
        reader.onload = async (e) => {
          try {
            const content = e.target?.result as string
            const workflowData = JSON.parse(content)

            // Validate workflow data structure
            if (!workflowData.definition || !workflowData.name) {
              showAlert('Invalid workflow file format. Please ensure the file contains a valid workflow definition.', 'danger')
              return
            }

            // Store the workflow data and show confirmation modal
            setPendingWorkflowData(workflowData)
            setIsConfirmationOpen(true)

          } catch (parseError) {
            showAlert('Error parsing workflow file. Please ensure the file contains valid JSON.', 'danger')
          }
        }
        reader.readAsText(file)
      } catch (error) {
        showAlert('Error loading workflow file.', 'danger')
      }
    }
    input.click()
  }

  return {
    handleFileUpload,
    isConfirmationOpen,
    setIsConfirmationOpen,
    handleConfirmOverwrite,
    pendingWorkflowData
  }
}