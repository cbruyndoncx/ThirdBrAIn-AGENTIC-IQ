import { FlowWorkflowNode, FlowWorkflowNodeConfig } from '@/types/api_types/nodeTypeSchemas'
import {
    Accordion,
    AccordionItem,
    Alert,
    Button,
    Card,
    Input,
    Select,
    SelectItem,
    SelectSection,
    Slider,
    Switch,
    Textarea,
    Tooltip,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import { cloneDeep, debounce, set } from 'lodash'
import isEqual from 'lodash/isEqual'
import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { jsonOptions } from '../../../constants/jsonOptions'
import {
    selectNodeById,
    setSelectedNode,
    setSidebarWidth,
    updateNodeConfigOnly,
    updateNodeTitle,
} from '../../../store/flowSlice'
import {
    FlowWorkflowNodeType,
    FlowWorkflowNodeTypesByCategory,
    selectPropertyMetadata,
} from '../../../store/nodeTypesSlice'
import { RootState } from '../../../store/store'
import { FieldMetadata, ModelConstraints } from '../../../types/api_types/modelMetadataSchemas'
import { listVectorIndices } from '../../../utils/api'
import CodeEditor from '../../CodeEditor'
import NumberInput from '../../NumberInput'
import FewShotExamplesEditor from '../../textEditor/FewShotExamplesEditor'
import TextEditor from '../../textEditor/TextEditor'
import NodeOutput from '../NodeOutputDisplay'
import OutputSchemaEditor from './OutputSchemaEditor'
import SchemaEditor from './SchemaEditor'

import { extractSchemaFromJsonSchema, generateJsonSchemaFromSchema } from '@/utils/schemaUtils'
import { convertToPythonVariableName } from '@/utils/variableNameUtils'
import Ajv from 'ajv'

// Define types for props and state
interface NodeSidebarProps {
    nodeID: string
}

// Update findNodeSchema to use imported types
const findNodeSchema = (nodeType: string, nodeTypes: FlowWorkflowNodeTypesByCategory): FlowWorkflowNodeType | null => {
    if (!nodeTypes) return null

    for (const category in nodeTypes) {
        const nodeSchema = nodeTypes[category]?.find((n: FlowWorkflowNodeType) => n.name === nodeType)
        if (nodeSchema) {
            return nodeSchema
        }
    }
    return null
}

const nodeComparator = (prevNode: FlowWorkflowNode, nextNode: FlowWorkflowNode) => {
    if (!prevNode || !nextNode) return false
    // Skip position and measured properties when comparing nodes
    const { position: prevPosition, measured: prevMeasured, ...prevRest } = prevNode
    const { position: nextPosition, measured: nextMeasured, ...nextRest } = nextNode
    return isEqual(prevRest, nextRest)
}

const nodesComparator = (prevNodes: FlowWorkflowNode[], nextNodes: FlowWorkflowNode[]) => {
    if (!prevNodes || !nextNodes) return false
    if (prevNodes.length !== nextNodes.length) return false
    return prevNodes.every((node, index) => nodeComparator(node, nextNodes[index]))
}

// Add this helper function near the top, after extractSchemaFromJsonSchema
const getModelConstraints = (nodeSchema: FlowWorkflowNodeType | null, modelId: string): ModelConstraints | null => {
    if (!nodeSchema || !nodeSchema.model_constraints || !nodeSchema.model_constraints[modelId]) {
        return null
    }
    return nodeSchema.model_constraints[modelId]
}

// Add this after other interfaces
interface VectorIndexOption {
    id: string
    name: string
    description?: string
    status: string
}

// Add after other const declarations at the top
const ajv = new Ajv({
    strict: false,
    allErrors: true,
})

// Replace the validateJsonSchema function with this enhanced version
const validateJsonSchema = (schema: string): string | null => {
    if (!schema || !schema.trim()) {
        return 'Schema cannot be empty'
    }

    let parsedSchema: any

    // First try to parse the JSON
    try {
        parsedSchema = JSON.parse(schema)
    } catch (e: any) {
        // Extract line and column info from the error message if available
        const match = e.message.match(/at position (\d+)(?:\s*\(line (\d+) column (\d+)\))?/)
        if (match) {
            const [, pos, line, col] = match
            if (line && col) {
                return `Invalid JSON: ${e.message.split('at position')[0].trim()} at line ${line}, column ${col}`
            }
            return `Invalid JSON: ${e.message.split('at position')[0].trim()} at position ${pos}`
        }
        return `Invalid JSON: ${e.message}`
    }

    // Now validate the schema structure
    try {
        // Basic structure validation
        if (!parsedSchema.properties) {
            return 'Schema must have a properties field'
        }

        if (typeof parsedSchema.properties !== 'object') {
            return 'properties must be an object'
        }

        // Check that all required properties exist in properties object
        if (Array.isArray(parsedSchema.required)) {
            const missingProps = parsedSchema.required.filter((prop: string) => !parsedSchema.properties[prop])
            if (missingProps.length > 0) {
                return `Required properties [${missingProps.join(', ')}] are missing from properties object`
            }
        }

        // Check that each property has a valid type
        const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null']
        for (const [propName, propSchema] of Object.entries(parsedSchema.properties)) {
            if (typeof propSchema !== 'object') {
                return `Property "${propName}" must be an object with a type field`
            }
            if (!('type' in propSchema)) {
                return `Property "${propName}" must have a type field`
            }
            if (!validTypes.includes((propSchema as any).type)) {
                return `Property "${propName}" has invalid type "${(propSchema as any).type}". Valid types are: ${validTypes.join(', ')}`
            }
        }

        // Validate against JSON Schema meta-schema
        const validate = ajv.compile({
            type: 'object',
            required: ['type', 'properties'],
            properties: {
                type: { type: 'string', enum: ['object'] },
                properties: {
                    type: 'object',
                    additionalProperties: {
                        type: 'object',
                        required: ['type'],
                        properties: {
                            type: { type: 'string', enum: validTypes },
                        },
                    },
                },
                required: {
                    type: 'array',
                    items: { type: 'string' },
                },
            },
        })

        if (!validate(parsedSchema)) {
            return validate.errors?.[0]?.message || 'Invalid JSON Schema structure'
        }

        return null
    } catch (e: any) {
        return `Schema validation error: ${e.message}`
    }
}

// Add this helper function before the NodeSidebar component
const isTemplateField = (key: string, fieldMetadata?: FieldMetadata): boolean => {
    // First check explicit template flag from metadata
    if (fieldMetadata?.template === true) {
        return true
    }

    // Check known template field names and suffixes
    const templatePatterns = ['template', 'message', 'prompt']
    return templatePatterns.some(pattern => key === pattern || key.endsWith(pattern))
}

const NodeSidebar: React.FC<NodeSidebarProps> = ({ nodeID }) => {
    const dispatch = useDispatch()
    const nodes = useSelector((state: RootState) => state.flow.nodes, nodesComparator)
    const edges = useSelector((state: RootState) => state.flow.edges, isEqual)
    const nodeTypes = useSelector((state: RootState) => state.nodeTypes.data)
    const nodeTypesMetadata = useSelector((state: RootState) => state.nodeTypes).metadata
    const node = useSelector((state: RootState) => selectNodeById(state, nodeID))
    const storedWidth = useSelector((state: RootState) => state.flow.sidebarWidth)
    const nodeConfig = useSelector((state: RootState) => state.flow.nodeConfigs[nodeID])
    const allNodeConfigs = useSelector((state: RootState) => state.flow.nodeConfigs)

    const hasRunOutput = !!node?.data?.run

    const [width, setWidth] = useState<number>(storedWidth)
    const [isResizing, setIsResizing] = useState<boolean>(false)
    const [isResizerHovered, setIsResizerHovered] = useState<boolean>(false)

    const [nodeType, setNodeType] = useState<string>(node?.type || 'ExampleNode')
    const [nodeSchema, setNodeSchema] = useState<FlowWorkflowNodeType | null>(
        findNodeSchema(node?.type || 'ExampleNode', nodeTypes)
    )
    const [currentNodeConfig, setCurrentNodeConfig] = useState<FlowWorkflowNodeConfig>(nodeConfig || {})
    const [fewShotIndex, setFewShotIndex] = useState<number | null>(null)
    const [showTitleError, setShowTitleError] = useState(false)
    const [jsonSchemaError, setJsonSchemaError] = useState<string>('')

    // Add state for vector indices
    const [vectorIndices, setVectorIndices] = useState<VectorIndexOption[]>([])
    const [isLoadingIndices, setIsLoadingIndices] = useState(false)

    // Add this near other state variables (e.g., after currentNodeConfig state)
    const [currentModelConstraints, setCurrentModelConstraints] = useState<ModelConstraints | null>(null)

    const collectIncomingSchema = (nodeID: string): string[] => {
        const incomingEdges = edges.filter((edge) => edge.target === nodeID)
        const incomingNodes = incomingEdges.map((edge) => nodes.find((n) => n.id === edge.source))

        return incomingNodes.reduce((acc: string[], node) => {
            if (!node) return acc
            const config = allNodeConfigs[node.id]
            if (config?.output_json_schema) {
                const nodeTitle = config.title || node.id
                const { schema, error } = extractSchemaFromJsonSchema(config.output_json_schema)
                if (error) {
                    console.error('Error parsing output_json_schema:', error)
                    return acc
                }

                if (schema && typeof schema === 'object') {
                    // For router nodes, handle the nested structure
                    if (node.type === 'RouterNode') {
                        Object.entries(schema).forEach(([routeKey, routeValue]) => {
                            if (routeValue && typeof routeValue === 'object') {
                                // The router node's schema has properties nested under each route
                                const routeProperties = (routeValue as any).properties
                                if (routeProperties && typeof routeProperties === 'object') {
                                    Object.keys(routeProperties).forEach((propKey) => {
                                        acc.push(`${nodeTitle}.${routeKey}.${propKey}`)
                                    })
                                }
                            }
                        })
                    } else {
                        // For other nodes, keep the existing one-level behavior
                        Object.keys(schema).forEach((key) => {
                            acc.push(`${nodeTitle}.${key}`)
                        })
                    }
                }
            }
            return acc
        }, [])
    }
    const [incomingSchema, setIncomingSchema] = useState<string[]>(collectIncomingSchema(nodeID))

    useEffect(() => {
        setIncomingSchema(collectIncomingSchema(nodeID))
    }, [nodeID, nodes, edges])

    // Create a debounced version of the dispatch update
    const debouncedDispatch = useCallback(
        debounce((id: string, updatedModel: FlowWorkflowNodeConfig) => {
            dispatch(updateNodeConfigOnly({ id, data: updatedModel }))
        }, 300),
        [dispatch]
    )

    // Add debounced validation
    const debouncedValidate = useCallback(
        debounce((value: string) => {
            const error = validateJsonSchema(value)
            setJsonSchemaError(error || '')
        }, 500),
        []
    )

    // Helper function to update nested object by path
    const updateNestedModel = (obj: FlowWorkflowNodeConfig, path: string, value: any): FlowWorkflowNodeConfig => {
        const deepClone = cloneDeep(obj)
        set(deepClone, path, value)
        return deepClone
    }

    // Update the input change handler to use local state immediately but debounce Redux updates for Slider
    const handleInputChange = (key: string, value: any, isSlider: boolean = false) => {
        let updatedModel: FlowWorkflowNodeConfig

        if (key.includes('.')) {
            updatedModel = updateNestedModel(currentNodeConfig, key, value) as FlowWorkflowNodeConfig
        } else {
            updatedModel = {
                ...currentNodeConfig,
                [key]: value,
            } as FlowWorkflowNodeConfig
        }

        // Update local state first
        setCurrentNodeConfig(updatedModel)

        // Then update Redux store
        if (isSlider) {
            debouncedDispatch(nodeID, updatedModel)
        } else {
            dispatch(updateNodeConfigOnly({ id: nodeID, data: updatedModel }))
        }
    }

    // Simplify the title change handlers into a single function
    const handleTitleChangeComplete = (value: string) => {
        const validTitle = convertToPythonVariableName(value)
        dispatch(updateNodeTitle({ nodeId: nodeID, newTitle: validTitle }))
    }

    // Update the renderEnumSelect function's model selection handler
    const renderEnumSelect = (
        key: string,
        label: string,
        enumValues: string[],
        fullPath: string,
        defaultSelected?: string
    ) => {
        const lastTwoDots = fullPath.split('.').slice(-2).join('.')

        // Special handling for LLM model selection
        if (key === 'model' && fullPath.includes('llm_info')) {
            // Group models by provider
            const modelsByProvider: {
                [key: string]: { id: string; name: string }[]
            } = {
                OpenAI: [],
                Anthropic: [],
                Google: [],
                Deepseek: [],
                Ollama: [],
            }

            enumValues.forEach((modelId) => {
                if (modelId.startsWith('ollama/')) {
                    modelsByProvider.Ollama.push({
                        id: modelId,
                        name: modelId.replace('ollama/', ''),
                    })
                } else if (modelId.startsWith('anthropic')) {
                    modelsByProvider.Anthropic.push({ id: modelId, name: modelId })
                } else if (modelId.startsWith('gemini')) {
                    modelsByProvider.Google.push({ id: modelId, name: modelId })
                } else if (modelId.startsWith('deepseek')) {
                    modelsByProvider.Deepseek.push({ id: modelId, name: modelId })
                } else {
                    modelsByProvider.OpenAI.push({ id: modelId, name: modelId })
                }
            })

            // Ensure we have a valid default value
            const currentValue = currentNodeConfig?.llm_info?.model || defaultSelected || 'gpt-4o'

            return (
                <div key={key}>
                    <Select
                        key={`select-${nodeID}-${key}`}
                        label={label}
                        selectedKeys={[currentValue]}
                        onChange={(e) => {
                            const selectedModelId = e.target.value
                            // Get constraints for the selected model
                            const modelConstraints = getModelConstraints(nodeSchema, selectedModelId)

                            // Create updated model config with new constraints
                            const updatedModel = {
                                ...currentNodeConfig,
                                llm_info: {
                                    ...currentNodeConfig.llm_info,
                                    model: selectedModelId,
                                    // Apply model constraints
                                    ...(modelConstraints && {
                                        max_tokens: Math.min(
                                            currentNodeConfig.llm_info?.max_tokens || modelConstraints.max_tokens,
                                            modelConstraints.max_tokens
                                        ),
                                        temperature: Math.min(
                                            Math.max(
                                                currentNodeConfig.llm_info?.temperature || 0.7,
                                                modelConstraints.min_temperature
                                            ),
                                            modelConstraints.max_temperature
                                        ),
                                    }),
                                },
                            }
                            setCurrentNodeConfig(updatedModel)
                            dispatch(updateNodeConfigOnly({ id: nodeID, data: updatedModel }))
                        }}
                        fullWidth
                    >
                        {Object.entries(modelsByProvider).map(
                            ([provider, models], index) =>
                                models.length > 0 && (
                                    <SelectSection
                                        key={`provider-${provider}`}
                                        title={provider}
                                        showDivider={index < Object.keys(modelsByProvider).length - 1}
                                    >
                                        {models.map((model) => (
                                            <SelectItem key={model.id} value={model.id}>
                                                {model.name}
                                            </SelectItem>
                                        ))}
                                    </SelectSection>
                                )
                        )}
                    </Select>
                </div>
            )
        }

        // Default rendering for other enum fields
        const currentValue = defaultSelected || currentNodeConfig[key] || enumValues[0]
        return (
            <div key={key}>
                <Select
                    key={`select-${nodeID}-${key}`}
                    label={key}
                    selectedKeys={[currentValue]}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    fullWidth
                >
                    {enumValues.map((option) => (
                        <SelectItem key={option} value={option}>
                            {option}
                        </SelectItem>
                    ))}
                </Select>
            </div>
        )
    }

    const handleAddNewExample = () => {
        const updatedExamples = [...(currentNodeConfig?.few_shot_examples || []), { input: '', output: '' }]
        handleInputChange('few_shot_examples', updatedExamples)
        setFewShotIndex(updatedExamples.length - 1)
    }

    const handleDeleteExample = (index: number) => {
        const updatedExamples = [...(currentNodeConfig?.few_shot_examples || [])]
        updatedExamples.splice(index, 1)
        handleInputChange('few_shot_examples', updatedExamples)
    }

    // Update the `getFieldMetadata` function
    const getFieldMetadata = (fullPath: string): FieldMetadata | undefined => {
        return selectPropertyMetadata(
            {
                nodeTypes: { data: nodeTypes, metadata: nodeTypesMetadata },
            } as unknown as RootState,
            fullPath
        ) as FieldMetadata
    }

    const initializeOutputJsonSchema = () => {
        const jsonSchema = generateJsonSchemaFromSchema(nodeConfig.output_schema)
        if (jsonSchema) {
            const updates = {
                output_json_schema: jsonSchema,
            }
            setCurrentNodeConfig((prev) => ({
                ...prev,
                ...updates,
            }))
            dispatch(
                updateNodeConfigOnly({
                    id: nodeID,
                    data: {
                        ...currentNodeConfig,
                        ...updates,
                    },
                })
            )
        }
    }

    useEffect(() => {
        if (nodeConfig.output_schema && !currentNodeConfig.output_json_schema) {
            initializeOutputJsonSchema()
        }
    }, [])

    // Update function to fetch vector indices
    const fetchVectorIndices = async () => {
        try {
            setIsLoadingIndices(true)
            const indices = await listVectorIndices()
            setVectorIndices(indices)
        } catch (error) {
            console.error('Error fetching vector indices:', error)
        } finally {
            setIsLoadingIndices(false)
        }
    }

    // Add effect to fetch indices when node type is RetrieverNode
    useEffect(() => {
        if (node?.type === 'RetrieverNode') {
            fetchVectorIndices()
        }
    }, [node?.type])

    // Add useEffect to validate initial schema
    useEffect(() => {
        if (currentNodeConfig?.output_json_schema) {
            debouncedValidate(currentNodeConfig.output_json_schema)
        }
    }, [currentNodeConfig?.output_json_schema])

    // Update renderField to handle vector index selection
    const renderField = (key: string, field: any, value: any, parentPath: string = '', isLast: boolean = false) => {
        const fullPath = `${parentPath ? `${parentPath}.` : ''}${key}`
        const fieldMetadata = getFieldMetadata(fullPath) as FieldMetadata

        // Special handling for vector_index_id field in RetrieverNode
        if (key === 'vector_index_id' && node?.type === 'RetrieverNode') {
            const isMissingVectorIndexRequired = Boolean(fieldMetadata?.required) && !value
            return (
                <div key={key} className="my-4">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">Vector Index</h3>
                        <Tooltip
                            content="Select a vector index to retrieve documents from. Only indices with 'ready' status are available."
                            placement="left-start"
                            showArrow={true}
                            className="max-w-xs"
                        >
                            <Icon
                                icon="solar:question-circle-linear"
                                className="text-default-400 cursor-help"
                                width={20}
                            />
                        </Tooltip>
                    </div>
                    {isMissingVectorIndexRequired && (
                        <Alert color="warning" className="mb-2">
                            <div className="flex items-center gap-2">
                                <Icon icon="solar:danger-triangle-linear" width={20} />
                                <span>A vector index is required but not selected.</span>
                            </div>
                        </Alert>
                    )}
                    <Select
                        key={`select-${nodeID}-${key}`}
                        label="Select Vector Index"
                        items={vectorIndices}
                        selectedKeys={value ? [value] : []}
                        placeholder="Select a vector index"
                        classNames={{
                            value: 'text-small',
                            base: isMissingVectorIndexRequired ? 'border-warning' : '',
                        }}
                        renderValue={(items) => {
                            const selectedIndex = items[0]
                            return (
                                <div className="flex flex-col">
                                    <span>{selectedIndex?.data?.name}</span>
                                </div>
                            )
                        }}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        isLoading={isLoadingIndices}
                        fullWidth
                    >
                        {(index) => (
                            <SelectItem
                                key={index.id}
                                value={index.id}
                                textValue={index.name}
                                description={`Status: ${index.status}`}
                                isDisabled={index.status !== 'ready'}
                            >
                                <div className="flex flex-col">
                                    <span className="text-small">{index.name}</span>
                                    <span className="text-tiny text-default-400">ID: {index.id}</span>
                                </div>
                            </SelectItem>
                        )}
                    </Select>
                    {vectorIndices.length === 0 && !isLoadingIndices && (
                        <p className="text-sm text-default-500 mt-2">
                            No vector indices available. Please create one first.
                        </p>
                    )}
                    {!isLast && <hr className="my-2" />}
                </div>
            )
        }

        // Skip api_base field if the selected model is not an Ollama model
        if (key === 'api_base') {
            const modelValue = currentNodeConfig?.llm_info?.model
            if (!modelValue || !modelValue.toString().startsWith('ollama/')) {
                return null
            }
            // Add default value for Ollama models
            return (
                <div key={key} className="my-4">
                    <Input
                        key={`input-${nodeID}-${key}`}
                        fullWidth
                        label={fieldMetadata?.title || key}
                        value={value || 'http://localhost:11434'}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        placeholder="Enter API base URL"
                    />
                    {!isLast && <hr className="my-2" />}
                </div>
            )
        }

        // Handle enum fields
        if (fieldMetadata?.enum) {
            const defaultSelected = value || fieldMetadata.default
            return renderEnumSelect(key, fieldMetadata.title || key, fieldMetadata.enum, fullPath, defaultSelected)
        }

        if (key === 'output_schema') {
            return null
        }

        if (key === 'output_json_schema') {
            const isReadOnly =
                currentNodeConfig?.has_fixed_output ||
                (currentNodeConfig?.llm_info?.model && !currentModelConstraints?.supports_JSON_output) ||
                node.type === 'RouterNode' ||
                node.type === 'CoalesceNode' ||
                false
            return (
                <div key={key}>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">Output Schema</h3>
                        <Tooltip
                            content={
                                currentNodeConfig?.has_fixed_output === true
                                    ? "This node has a fixed output schema that cannot be modified. The JSON schema provides detailed validation rules for the node's output."
                                    : currentNodeConfig?.llm_info?.model &&
                                        currentModelConstraints?.supports_JSON_output
                                      ? "Define the structure of this node's output. You can use either the Simple Editor for basic types, or the JSON Schema Editor for more complex validation rules."
                                      : currentNodeConfig?.llm_info?.model &&
                                          !currentModelConstraints?.supports_JSON_output
                                        ? "This model only supports a fixed output schema with a single 'output' field of type string. Schema editing is disabled."
                                        : "The output schema defines the structure of this node's output."
                            }
                            placement="left-start"
                            showArrow={true}
                            className="max-w-xs"
                        >
                            <Icon
                                icon="solar:question-circle-linear"
                                className="text-default-400 cursor-help"
                                width={20}
                            />
                        </Tooltip>
                        {!currentNodeConfig?.has_fixed_output && currentNodeConfig?.llm_info?.model && (
                            <Button
                                isIconOnly
                                radius="full"
                                variant="light"
                                size="sm"
                                onClick={() => {
                                    const defaultSchema = {
                                        type: 'object',
                                        properties: {
                                            output: { type: 'string' },
                                        },
                                        required: ['output'],
                                    }
                                    handleInputChange('output_json_schema', JSON.stringify(defaultSchema, null, 2))
                                }}
                            >
                                <Icon icon="solar:restart-linear" width={20} />
                            </Button>
                        )}
                    </div>
                    {currentNodeConfig?.has_fixed_output && (
                        <p className="text-sm text-default-500 mb-2">
                            This node has a fixed output schema that cannot be modified.
                        </p>
                    )}
                    <OutputSchemaEditor
                        nodeID={nodeID}
                        schema={currentNodeConfig.output_json_schema || ''}
                        readOnly={isReadOnly}
                        error={jsonSchemaError}
                        onChange={(newSchema) => {
                            handleInputChange('output_json_schema', newSchema)
                            debouncedValidate(newSchema)
                        }}
                    />
                    {!isLast && <hr className="my-2" />}
                </div>
            )
        }

        if (key === 'input_map') {
            return renderInputMapField(key, value, incomingSchema, handleInputChange)
        }

        if (key === 'output_map') {
            return renderOutputMapField(key, value, incomingSchema, handleInputChange)
        }

        if (key === 'has_fixed_output') {
            return null
        }

        // Handle code editor fields
        if (key === 'code') {
            return (
                <CodeEditor
                    key={`code-editor-${nodeID}-${key}`}
                    code={value}
                    mode="python"
                    onChange={(newValue: string) => handleInputChange(key, newValue)}
                />
            )
        }

        // Handle template fields
        if (isTemplateField(key, fieldMetadata)) {
            let tooltipContent = fieldMetadata?.description

            // Use specific tooltips for well-known template fields
            if (key === 'system_message') {
                tooltipContent = "The System Message sets the AI's behavior, role, and constraints. It's like giving the AI its job description and rules to follow. Use it to define the tone, format, and any specific requirements for the responses."
            } else if (key === 'user_message') {
                tooltipContent = "The User Message is your main prompt template. Use variables like {{input.variable}} to make it dynamic. This is where you specify what you want the AI to do with each input it receives."
            } else {
                tooltipContent = tooltipContent || "Use variables like {{input.variable}} to make the content dynamic. This template will be rendered with data from connected nodes."
            }

            return (
                <div key={key}>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{fieldMetadata?.title || key}</h3>
                        {tooltipContent && tooltipContent.length > 0 && (
                            <Tooltip
                                content={tooltipContent}
                                placement="left-start"
                                showArrow={true}
                                className="max-w-xs"
                            >
                                <Icon
                                    icon="solar:question-circle-linear"
                                    className="text-default-400 cursor-help"
                                    width={20}
                                />
                            </Tooltip>
                        )}
                    </div>
                    <TextEditor
                        key={`text-editor-${nodeID}-${key}`}
                        nodeID={nodeID}
                        fieldName={key}
                        inputSchema={incomingSchema}
                        fieldTitle={key}
                        content={currentNodeConfig[key] || ''}
                        setContent={(value) => handleInputChange(key, value)}
                        disableFormatting={key.endsWith('_template')}  // Disable formatting for pure template fields
                        isTemplateEditor={true}  // This is a template editor in NodeSidebar
                    />
                    {key === 'user_message' && renderFewShotExamples()}
                    {!isLast && <hr className="my-2" />}
                </div>
            )
        }

        // Handle other types (string, number, boolean, object)
        switch (typeof field) {
            case 'string': {
                const isMissingStringRequired =
                    Boolean(fieldMetadata?.required) && (value === '' || value === undefined || value === null)
                return (
                    <div key={key} className="my-4">
                        {isMissingStringRequired && (
                            <Alert color="warning" className="mb-2">
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:danger-triangle-linear" width={20} />
                                    <span>This field is required but not set.</span>
                                </div>
                            </Alert>
                        )}
                        <Textarea
                            key={`textarea-${nodeID}-${key}`}
                            fullWidth
                            label={`${fieldMetadata?.title || key}${Boolean(fieldMetadata?.required) ? ' *' : ''}`}
                            className={isMissingStringRequired ? 'border-warning' : ''}
                            value={value}
                            onChange={(e) => handleInputChange(key, e.target.value)}
                            placeholder="Enter your input"
                        />
                        {!isLast && <hr className="my-2" />}
                    </div>
                )
            }
            case 'number': {
                const isMissingNumberRequired =
                    Boolean(fieldMetadata?.required) && (value === undefined || value === null)
                // Get current model constraints if this is a temperature or max_tokens field
                const modelConstraints = currentModelConstraints

                let min = fieldMetadata?.minimum ?? 0
                let max = fieldMetadata?.maximum ?? 100

                // Override constraints based on model if available
                if (modelConstraints) {
                    if (key === 'temperature' || fullPath.endsWith('.temperature')) {
                        min = modelConstraints.min_temperature
                        max = modelConstraints.max_temperature
                        // Ensure value is within constraints
                        if (value < min) value = min
                        if (value > max) value = max
                    } else if (key === 'max_tokens' || fullPath.endsWith('.max_tokens')) {
                        max = modelConstraints.max_tokens
                        // Ensure value is within constraints
                        if (value > max) value = max
                    }
                }

                // If this is the max_tokens field and the model does not support it, render a disabled slider with a tooltip
                if (
                    (key === 'max_tokens' || fullPath.endsWith('.max_tokens')) &&
                    modelConstraints &&
                    !modelConstraints.supports_max_tokens
                ) {
                    return (
                        <div key={key} className="my-4">
                            <Tooltip
                                content="max_tokens is not supported for the selected model"
                                placement="top"
                                showArrow
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="font-semibold">{fieldMetadata.title || key}</label>
                                        <span className="text-sm">{value}</span>
                                    </div>
                                    <Slider
                                        isDisabled={true}
                                        key={`slider-${nodeID}-${key}`}
                                        aria-label={fieldMetadata.title || key}
                                        value={value}
                                        minValue={value}
                                        maxValue={value}
                                        step={fieldMetadata.type === 'integer' ? 1 : 0.1}
                                        className="w-full"
                                    />
                                </div>
                            </Tooltip>
                            {!isLast && <hr className="my-2" />}
                        </div>
                    )
                }

                // If this is the temperature field and the model does not support it, render a disabled slider with a tooltip
                if (
                    (key === 'temperature' || fullPath.endsWith('.temperature')) &&
                    modelConstraints &&
                    !modelConstraints.supports_temperature
                ) {
                    return (
                        <div key={key} className="my-4">
                            <Tooltip
                                content="Temperature is not supported for the selected model"
                                placement="top"
                                showArrow
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="font-semibold">{fieldMetadata.title || key}</label>
                                        <span className="text-sm">{value}</span>
                                    </div>
                                    <Slider
                                        isDisabled={true}
                                        key={`slider-${nodeID}-${key}`}
                                        aria-label={fieldMetadata.title || key}
                                        value={value}
                                        minValue={value}
                                        maxValue={value}
                                        step={fieldMetadata.type === 'integer' ? 1 : 0.1}
                                        className="w-full"
                                    />
                                </div>
                            </Tooltip>
                            {!isLast && <hr className="my-2" />}
                        </div>
                    )
                }

                if (fieldMetadata && (min !== undefined || max !== undefined)) {
                    return (
                        <div key={key} className="my-4">
                            {isMissingNumberRequired && (
                                <Alert color="warning" className="mb-2">
                                    <div className="flex items-center gap-2">
                                        <Icon icon="solar:danger-triangle-linear" width={20} />
                                        <span>This field is required but not set.</span>
                                    </div>
                                </Alert>
                            )}
                            <div className="flex justify-between items-center mb-2">
                                <label className="font-semibold">{fieldMetadata.title || key}</label>
                                <span className="text-sm">{value}</span>
                            </div>
                            <Slider
                                key={`slider-${nodeID}-${key}`}
                                aria-label={fieldMetadata.title || key}
                                value={value}
                                minValue={min}
                                maxValue={max}
                                step={fieldMetadata.type === 'integer' ? 1 : 0.1}
                                className="w-full"
                                onChange={(newValue) => {
                                    const path = parentPath ? `${parentPath}.${key}` : key
                                    const lastTwoDots = path.split('.').slice(-2)
                                    const finalPath =
                                        lastTwoDots[0] === 'config' ? lastTwoDots[1] : lastTwoDots.join('.')
                                    handleInputChange(finalPath, newValue, true)
                                }}
                            />
                            {!isLast && <hr className="my-2" />}
                        </div>
                    )
                }

                return (
                    <div key={key} className="my-4">
                        {isMissingNumberRequired && (
                            <Alert color="warning" className="mb-2">
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:danger-triangle-linear" width={20} />
                                    <span>This field is required but not set.</span>
                                </div>
                            </Alert>
                        )}
                        <NumberInput
                            key={`number-input-${nodeID}-${key}`}
                            label={key}
                            value={value}
                            onChange={(e) => {
                                const newValue = parseFloat(e.target.value)
                                handleInputChange(key, isNaN(newValue) ? 0 : newValue)
                            }}
                        />
                        {!isLast && <hr className="my-2" />}
                    </div>
                )
            }
            case 'boolean': {
                const isMissingBooleanRequired =
                    Boolean(fieldMetadata?.required) && (value === undefined || value === null)
                return (
                    <div key={key} className="my-4">
                        <div className="flex justify-between items-center">
                            <label className="font-semibold">
                                {fieldMetadata?.title || key}
                                {Boolean(fieldMetadata?.required) && <span className="text-warning ml-1">*</span>}
                            </label>
                            <Switch
                                key={`switch-${nodeID}-${key}`}
                                isSelected={value}
                                onChange={(e) => handleInputChange(key, e.target.checked)}
                                className={isMissingBooleanRequired ? 'border-warning' : ''}
                            />
                        </div>
                        {isMissingBooleanRequired && (
                            <Alert color="warning" className="mt-2">
                                <div className="flex items-center gap-2">
                                    <Icon icon="solar:danger-triangle-linear" width={20} />
                                    <span>This field is required but not set.</span>
                                </div>
                            </Alert>
                        )}
                        {!isLast && <hr className="my-2" />}
                    </div>
                )
            }
            case 'object':
                if (field && typeof field === 'object' && !Array.isArray(field)) {
                    return (
                        <div key={key} className="my-2">
                            {Object.keys(field).map((subKey) =>
                                renderField(subKey, field[subKey], value?.[subKey], fullPath)
                            )}
                            {!isLast && <hr className="my-2" />}
                        </div>
                    )
                }
                return null
            default:
                return null
        }
    }

    // Update renderConfigFields to include URL variable configuration
    const renderConfigFields = (): React.ReactNode => {
        if (!nodeSchema || !nodeSchema.config || !currentNodeConfig) return null
        const properties = nodeSchema.config

        const keys = Object.keys(properties).filter((key) => key !== 'title' && key !== 'type')

        // Prioritize system_message, user_message, and template fields to appear first
        const priorityFields = ['system_message', 'user_message']
        const templateFields = keys.filter(key =>
            key.includes('template') ||
            key.includes('message') ||
            key.includes('prompt')
        ).filter(key => !priorityFields.includes(key))

        const remainingKeys = keys.filter((key) =>
            !priorityFields.includes(key) &&
            !templateFields.includes(key)
        )

        const orderedKeys = [
            ...priorityFields.filter((key) => keys.includes(key)),
            ...templateFields,
            ...remainingKeys
        ]

        return (
            <React.Fragment>
                {orderedKeys.map((key, index) => {
                    const field = properties[key]
                    const value = currentNodeConfig[key]
                    const isLast = index === orderedKeys.length - 1
                    const result = renderField(key, field, value, `${nodeType}.config`, isLast)

                    // Insert URL variable config after template/message fields
                    if (index === priorityFields.length + templateFields.length - 1) {
                        return (
                            <React.Fragment key={key}>
                                {result}
                                {renderUrlVariableConfig()}
                            </React.Fragment>
                        )
                    }

                    return result
                })}
            </React.Fragment>
        )
    }

    // Update the `renderFewShotExamples` function
    const renderFewShotExamples = () => {
        return (
            <FewShotExamplesEditor
                nodeID={nodeID}
                examples={nodeConfig?.few_shot_examples || []}
                onChange={(examples) => {
                    dispatch(
                        updateNodeConfigOnly({
                            id: nodeID,
                            data: {
                                few_shot_examples: examples
                            }
                        })
                    )
                }}
                readOnly={false}
            />
        )
    }

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsResizing(true)
        e.preventDefault()
    }, [])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return

            const newWidth = window.innerWidth - e.clientX
            const constrainedWidth = Math.min(Math.max(newWidth, 300), 800)
            if (constrainedWidth === width) return
            setWidth(constrainedWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            dispatch(setSidebarWidth(width))
        }

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, dispatch, width])

    const renderUrlVariableConfig = () => {
        // Only show for LLM nodes with Gemini models
        if (!currentNodeConfig?.llm_info?.model || !String(currentNodeConfig.llm_info.model).startsWith('gemini')) {
            return null
        }

        const incomingSchemaVars = collectIncomingSchema(nodeID)

        return (
            <div className="my-4">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">File Input</h3>
                    <Tooltip
                        content="Select an input variable containing either a file URL or inline data. For inline data, use the format: data:<mime_type>;base64,<encoded_data> (e.g., data:image/jpeg;base64,/9j/...)"
                        placement="left-start"
                        showArrow={true}
                        className="max-w-xs"
                    >
                        <Icon icon="solar:question-circle-linear" className="text-default-400 cursor-help" width={20} />
                    </Tooltip>
                </div>
                <div className="mb-2">
                    <Select
                        label="File URL or Data Variable"
                        selectedKeys={[currentNodeConfig?.url_variables?.file || '']}
                        onChange={(e) => {
                            const updatedUrlVars = e.target.value ? { file: e.target.value } : {}
                            handleInputChange('url_variables', updatedUrlVars)
                        }}
                    >
                        {['', ...incomingSchemaVars].map((variable) => (
                            <SelectItem key={variable} value={variable}>
                                {variable || 'None'}
                            </SelectItem>
                        ))}
                    </Select>
                    <p className="text-xs text-default-500 mt-1">
                        Supports both file URLs and inline data in the format:
                        data:&lt;mime_type&gt;;base64,&lt;encoded_data&gt;
                    </p>
                </div>
            </div>
        )
    }

    const renderInputMapField = (
        key: string,
        value: any,
        incomingSchema: string[],
        handleInputChange: (key: string, value: any) => void
    ) => {
        return (
            <div key={key} className="my-2">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">Input Mapping</h3>
                    <Tooltip
                        content="Map input fields from predecessor nodes to this node's input schema. Use the dropdown to select available fields from connected nodes."
                        placement="left-start"
                        showArrow={true}
                        className="max-w-xs"
                    >
                        <Icon icon="solar:question-circle-linear" className="text-default-400 cursor-help" width={20} />
                    </Tooltip>
                </div>
                <SchemaEditor
                    key={`input-map-editor-${nodeID}`}
                    jsonValue={value || {}}
                    onChange={(newValue) => handleInputChange(key, newValue)}
                    options={jsonOptions}
                    nodeId={nodeID}
                    availableFields={incomingSchema}
                />
            </div>
        )
    }

    const renderOutputMapField = (
        key: string,
        value: any,
        incomingSchema: string[],
        handleInputChange: (key: string, value: any) => void
    ) => {
        return (
            <div key={key} className="my-2">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">Output Mapping</h3>
                    <Tooltip
                        content="Map fields from this node's output schema to the incoming variables of this node"
                        placement="left-start"
                        showArrow={true}
                        className="max-w-xs"
                    >
                        <Icon icon="solar:question-circle-linear" className="text-default-400 cursor-help" width={20} />
                    </Tooltip>
                </div>
                <SchemaEditor
                    key={`output-map-editor-${nodeID}`}
                    jsonValue={value || {}}
                    onChange={(newValue) => handleInputChange(key, newValue)}
                    options={jsonOptions}
                    nodeId={nodeID}
                    availableFields={incomingSchema}
                />
            </div>
        )
    }

    useEffect(() => {
        if (currentNodeConfig?.llm_info?.model && nodeSchema) {
            const constraints = getModelConstraints(nodeSchema, currentNodeConfig.llm_info.model)
            setCurrentModelConstraints(constraints)
        } else {
            setCurrentModelConstraints(null)
        }
    }, [currentNodeConfig?.llm_info?.model, nodeSchema])

    return (
        <Card
            className="fixed top-16 bottom-4 right-4 p-4 rounded-xl border border-solid border-default-200 dark:border-default-100 overflow-auto bg-background/70 dark:bg-default-100/50"
            style={{
                width: `${width}px`,
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                borderRadius: '10px',
                backdropFilter: 'blur(8px)',
            }}
        >
            {showTitleError && (
                <Alert
                    key={`alert-${nodeID}`}
                    className="absolute top-4 left-4 right-4 z-50"
                    color="danger"
                    onClose={() => setShowTitleError(false)}
                >
                    Title cannot contain whitespace. Use underscores instead.
                </Alert>
            )}
            <div
                className="absolute top-0 right-0 h-full flex"
                style={{
                    width: '100%',
                    zIndex: 2,
                    userSelect: isResizing ? 'none' : 'auto',
                }}
            >
                <div
                    className="absolute left-0 top-0 h-full cursor-ew-resize"
                    onMouseDown={handleMouseDown}
                    style={{
                        width: isResizerHovered || isResizing ? '4px' : '3px',
                        backgroundColor: isResizing
                            ? 'var(--heroui-colors-primary)'
                            : isResizerHovered
                              ? 'var(--heroui-colors-primary-light)'
                              : 'rgba(0, 0, 0, 0.2)',
                        opacity: isResizing ? 1 : isResizerHovered ? 1 : 0,
                        borderRadius: '2px',
                    }}
                    onMouseEnter={(e) => {
                        setIsResizerHovered(true)
                        e.currentTarget.style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                        setIsResizerHovered(false)
                        if (!isResizing) e.currentTarget.style.opacity = '0'
                    }}
                />

                <div className="flex-1 px-6 py-1 overflow-auto max-h-screen" id="node-details">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <h1 className="text-lg font-semibold">{nodeConfig?.title || node?.id || 'Node Details'}</h1>
                            <h2 className="text-xs font-semibold">{nodeType}</h2>
                        </div>
                        <Button
                            key={`close-btn-${nodeID}`}
                            isIconOnly
                            radius="full"
                            variant="light"
                            onClick={() => dispatch(setSelectedNode({ nodeId: null }))}
                        >
                            <Icon
                                key={`close-icon-${nodeID}`}
                                className="text-default-500"
                                icon="solar:close-circle-linear"
                                width={24}
                            />
                        </Button>
                    </div>

                    <Accordion
                        key={`accordion-${nodeID}`}
                        selectionMode="multiple"
                        defaultExpandedKeys={hasRunOutput ? ['output'] : ['title', 'config']}
                    >
                        <AccordionItem key="output" aria-label="Output" title="Outputs">
                            <NodeOutput key={`node-output-${nodeID}`} output={node?.data?.run} />
                        </AccordionItem>
                        <AccordionItem key="config" aria-label="Node Configuration" title="Node Configuration">
                            <Input
                                key={`title-input-${nodeID}`}
                                defaultValue={nodeConfig?.title || node?.id || ''}
                                onBlur={(e) => handleTitleChangeComplete(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur()
                                    }
                                }}
                                placeholder="Enter node title"
                                label="Node Title"
                                fullWidth
                                description="Use underscores instead of spaces"
                            />
                            <hr className="my-2" />
                            {renderConfigFields()}
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>
        </Card>
    )
}

export default NodeSidebar
