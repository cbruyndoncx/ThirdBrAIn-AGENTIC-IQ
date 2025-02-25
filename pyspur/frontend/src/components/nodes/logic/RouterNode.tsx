import { FlowWorkflowNode } from '@/types/api_types/nodeTypeSchemas'
import { Button, Card, Divider, Input, Radio, RadioGroup, Select, SelectItem } from '@heroui/react'
import { Icon } from '@iconify/react'
import { Handle, NodeProps, Position, useConnection, useUpdateNodeInternals } from '@xyflow/react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { deleteEdgeByHandle, updateNodeConfigOnly } from '../../../store/flowSlice'
import { RootState } from '../../../store/store'
import { ComparisonOperator, RouteConditionGroup, RouteConditionRule } from '../../../types/api_types/routerSchemas'
import BaseNode from '../BaseNode'
import styles from '../DynamicNode.module.css'
import NodeOutputModal from '../NodeOutputModal'

export interface RouterNodeProps extends NodeProps<FlowWorkflowNode> {
    displayOutput?: boolean
    readOnly?: boolean
    displaySubflow?: boolean
    displayResizer?: boolean
}

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
    { value: ComparisonOperator.CONTAINS, label: 'Contains' },
    { value: ComparisonOperator.EQUALS, label: 'Equals' },
    { value: ComparisonOperator.NUMBER_EQUALS, label: 'Number Equals' },
    { value: ComparisonOperator.GREATER_THAN, label: 'Greater Than' },
    { value: ComparisonOperator.LESS_THAN, label: 'Less Than' },
    { value: ComparisonOperator.STARTS_WITH, label: 'Starts With' },
    { value: ComparisonOperator.NOT_STARTS_WITH, label: 'Does Not Start With' },
    { value: ComparisonOperator.IS_EMPTY, label: 'Is Empty' },
    { value: ComparisonOperator.IS_NOT_EMPTY, label: 'Is Not Empty' },
]

const DEFAULT_CONDITION: RouteConditionRule = {
    variable: '',
    operator: ComparisonOperator.CONTAINS,
    value: '',
}

const DEFAULT_ROUTE: RouteConditionGroup = {
    conditions: [{ ...DEFAULT_CONDITION }],
}

export const RouterNode: React.FC<RouterNodeProps> = ({
    id,
    data,
    readOnly = false,
    positionAbsoluteX,
    positionAbsoluteY,
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const nodeRef = useRef<HTMLDivElement | null>(null)
    const dispatch = useDispatch()
    const nodes = useSelector((state: RootState) => state.flow.nodes)
    const edges = useSelector((state: RootState) => state.flow.edges)
    const nodeConfig = useSelector((state: RootState) => state.flow.nodeConfigs[id])
    const nodeConfigs = useSelector((state: RootState) => state.flow.nodeConfigs)
    const updateNodeInternals = useUpdateNodeInternals()

    const connection = useConnection()
    const nodeData = {
        title: nodeConfig?.title || 'Conditional Router',
        color: data.color || '#F6AD55',
        acronym: 'RN',
        run: data.run,
        config: nodeConfig,
        taskStatus: data.taskStatus,
    }

    const finalPredecessors = useMemo(() => {
        const updatedPredecessorNodes = edges
            .filter((edge) => edge.target === id)
            .map((edge) => {
                const sourceNode = nodes.find((node) => node.id === edge.source)
                if (!sourceNode) {
                    return null
                }
                if (sourceNode.type === 'RouterNode' && edge.sourceHandle) {
                    return {
                        ...sourceNode,
                        handle_id: edge.sourceHandle,
                    }
                }
                return sourceNode
            })
            .filter(Boolean)

        let result = updatedPredecessorNodes

        // deduplicate
        result = result.filter((node, index, self) => self.findIndex((n) => n.id === node.id) === index)
        return result
    }, [edges, nodes, connection, id])

    // Get available input variables from the connected node's output schema
    const inputVariables = useMemo(() => {
        if (!finalPredecessors.length) {
            return []
        }
        return finalPredecessors.flatMap((node) => {
            if (!node) {
                return []
            }

            const predNodeConfig = nodeConfigs[node.id]
            const nodeTitle = predNodeConfig?.title || node.id

            let schemaProperties = {}
            try {
                const parsedSchema = predNodeConfig?.output_json_schema
                    ? JSON.parse(predNodeConfig.output_json_schema)
                    : {}
                schemaProperties = parsedSchema.properties || {}
            } catch (error) {
                console.error('Error parsing output_json_schema:', error)
            }

            return Object.entries(schemaProperties).map(([key, value]) => ({
                value: `${nodeTitle}.${key}`,
                label: `${nodeTitle}.${key} (${(value as any).type || 'unknown'})`,
            }))
        })
    }, [finalPredecessors, nodeConfigs])

    // Add this useEffect to update node internals when route_map changes
    useEffect(() => {
        if (nodeConfig?.route_map) {
            updateNodeInternals(id)
        }
    }, [nodeConfig?.route_map, id, updateNodeInternals])

    const handleUpdateRouteMap = (newRouteMap: Record<string, RouteConditionGroup>) => {
        dispatch(
            updateNodeConfigOnly({
                id,
                data: {
                    ...nodeConfig,
                    route_map: newRouteMap,
                },
            })
        )
    }

    const addRoute = () => {
        // Find the highest route number and increment by 1
        const routeNumbers = Object.keys(nodeConfig?.route_map || {})
            .map((key) => parseInt(key.replace('route', '')))
            .filter((num) => !isNaN(num))
        const nextRouteNumber = routeNumbers.length > 0 ? Math.max(...routeNumbers) + 1 : 1

        const newRouteMap = {
            ...(nodeConfig?.route_map || {}),
            [`route${nextRouteNumber}`]: { ...DEFAULT_ROUTE },
        }
        handleUpdateRouteMap(newRouteMap)
    }

    const removeRoute = (routeKey: string) => {
        if (!nodeConfig?.route_map) {
            return
        }

        // Delete the edge associated with this route
        dispatch(deleteEdgeByHandle({ nodeId: id, handleKey: routeKey }))

        // Simply remove the specified route without reordering
        const { [routeKey]: _, ...remainingRoutes } = nodeConfig.route_map
        handleUpdateRouteMap(remainingRoutes)
    }

    const addCondition = (routeKey: string) => {
        if (!nodeConfig?.route_map) {
            return
        }
        const newRouteMap = {
            ...nodeConfig.route_map,
            [routeKey]: {
                conditions: [
                    ...(nodeConfig.route_map[routeKey].conditions || []),
                    { ...DEFAULT_CONDITION, logicalOperator: 'AND' as const },
                ],
            },
        }
        handleUpdateRouteMap(newRouteMap)
    }

    const removeCondition = (routeKey: string, conditionIndex: number) => {
        if (!nodeConfig?.route_map) {
            return
        }
        const newRouteMap = {
            ...nodeConfig.route_map,
            [routeKey]: {
                conditions: nodeConfig.route_map[routeKey].conditions.filter((_, i) => i !== conditionIndex),
            },
        }
        handleUpdateRouteMap(newRouteMap)
    }

    const updateCondition = (
        routeKey: string,
        conditionIndex: number,
        field: keyof RouteConditionRule,
        value: string
    ) => {
        if (!nodeConfig?.route_map) {
            return
        }
        const newRouteMap = {
            ...nodeConfig.route_map,
            [routeKey]: {
                conditions: nodeConfig.route_map[routeKey].conditions.map((condition, i) =>
                    i === conditionIndex ? { ...condition, [field]: value } : condition
                ),
            },
        }
        handleUpdateRouteMap(newRouteMap)
    }

    useEffect(() => {
        // If route_map is empty, initialize it with a default route
        if (!nodeConfig?.route_map || Object.keys(nodeConfig.route_map).length === 0) {
            handleUpdateRouteMap({
                route1: { ...DEFAULT_ROUTE },
            })
        }
    }, [])

    return (
        <BaseNode
            id={id}
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
            data={nodeData}
            style={{ width: 'auto', maxHeight: '1200px', display: 'flex', flexDirection: 'column' }}
            handleOpenModal={setIsModalOpen}
            positionAbsoluteX={positionAbsoluteX}
            positionAbsoluteY={positionAbsoluteY}
            className="hover:!bg-background"
        >
            <div className="flex flex-col flex-grow overflow-hidden" ref={nodeRef}>
                {!isCollapsed && nodeConfig?.route_map && (
                    <div
                        className="p-5 overflow-y-auto"
                        style={{ touchAction: 'none' }}
                        onWheelCapture={(e) => {
                            e.stopPropagation()
                        }}
                    >
                        {/* Expressions Header - Now sticky */}
                        <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-4">
                            <Divider className="my-2" />
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-sm font-medium text-foreground">Expressions</span>
                                <Divider className="flex-grow" />
                            </div>
                        </div>

                        {/* Routes */}
                        <div className="flex flex-col gap-4">
                            {Object.entries(nodeConfig.route_map).map(([routeKey, route]) => (
                                <Card
                                    key={routeKey}
                                    classNames={{
                                        base: 'bg-background dark:bg-default-100/10 border-default-200 p-1',
                                    }}
                                >
                                    <div className="flex flex-col gap-3">
                                        {/* Add Route Header with Delete Button */}
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-sm font-medium text-foreground">{routeKey}</span>
                                            {!readOnly && Object.keys(nodeConfig.route_map).length > 1 && (
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    variant="light"
                                                    isIconOnly
                                                    onPress={() => removeRoute(routeKey)}
                                                    className="flex-none"
                                                >
                                                    <Icon icon="solar:trash-bin-trash-linear" width={18} />
                                                </Button>
                                            )}
                                        </div>

                                        {/* Conditions */}
                                        {route.conditions.map((condition, conditionIndex) => (
                                            <div key={conditionIndex} className="flex flex-col gap-2">
                                                {conditionIndex > 0 && (
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <RadioGroup
                                                            orientation="horizontal"
                                                            value={condition.logicalOperator}
                                                            onValueChange={(value) =>
                                                                updateCondition(
                                                                    routeKey,
                                                                    conditionIndex,
                                                                    'logicalOperator',
                                                                    value
                                                                )
                                                            }
                                                            size="sm"
                                                            isDisabled={readOnly}
                                                        >
                                                            <Radio value="AND">AND</Radio>
                                                            <Radio value="OR">OR</Radio>
                                                        </RadioGroup>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-[1fr,auto] gap-2">
                                                    <Select
                                                        aria-label="Select variable"
                                                        size="sm"
                                                        selectedKeys={condition.variable ? [condition.variable] : []}
                                                        onChange={(e) =>
                                                            updateCondition(
                                                                routeKey,
                                                                conditionIndex,
                                                                'variable',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Select variable"
                                                        className="w-full"
                                                        variant="flat"
                                                        classNames={{
                                                            trigger: 'dark:bg-default-50/10',
                                                            base: 'dark:bg-default-50/10',
                                                            popoverContent: 'dark:bg-default-50/10',
                                                        }}
                                                        renderValue={(items) => {
                                                            return items.map((item) => (
                                                                <div key={item.key} className="flex items-center">
                                                                    <span className="text-default-700 dark:text-default-300">
                                                                        {item.textValue}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        }}
                                                        isMultiline={true}
                                                        isDisabled={readOnly}
                                                    >
                                                        {inputVariables.map((variable) => (
                                                            <SelectItem
                                                                key={variable.value}
                                                                value={variable.value}
                                                                textValue={variable.label}
                                                                className="text-default-700 dark:text-default-300"
                                                            >
                                                                <div className="whitespace-normal">
                                                                    <span>{variable.label}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </Select>
                                                    {!readOnly && route.conditions.length > 1 && (
                                                        <Button
                                                            size="sm"
                                                            color="danger"
                                                            variant="light"
                                                            isIconOnly
                                                            onPress={() => removeCondition(routeKey, conditionIndex)}
                                                            className="flex-none"
                                                        >
                                                            <Icon icon="solar:trash-bin-trash-linear" width={18} />
                                                        </Button>
                                                    )}
                                                    <div className="flex gap-2 col-span-2">
                                                        <Select
                                                            aria-label="Select operator"
                                                            size="sm"
                                                            selectedKeys={
                                                                condition.operator ? [condition.operator] : []
                                                            }
                                                            onChange={(e) =>
                                                                updateCondition(
                                                                    routeKey,
                                                                    conditionIndex,
                                                                    'operator',
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="w-[120px] flex-none"
                                                            variant="flat"
                                                            classNames={{
                                                                trigger: 'dark:bg-default-50/10',
                                                                base: 'dark:bg-default-50/10',
                                                                popoverContent: 'dark:bg-default-50/10',
                                                            }}
                                                            renderValue={(items) => {
                                                                return items.map((item) => (
                                                                    <div key={item.key} className="flex items-center">
                                                                        <span className="text-default-700 dark:text-default-300">
                                                                            {item.textValue}
                                                                        </span>
                                                                    </div>
                                                                ))
                                                            }}
                                                            isDisabled={readOnly}
                                                        >
                                                            {OPERATORS.map((op) => (
                                                                <SelectItem
                                                                    key={op.value}
                                                                    value={op.value}
                                                                    textValue={op.label}
                                                                    className="text-default-700 dark:text-default-300"
                                                                >
                                                                    {op.label}
                                                                </SelectItem>
                                                            ))}
                                                        </Select>
                                                        {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
                                                            <Input
                                                                size="sm"
                                                                isRequired
                                                                value={condition.value}
                                                                onChange={(e) =>
                                                                    updateCondition(
                                                                        routeKey,
                                                                        conditionIndex,
                                                                        'value',
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="Value"
                                                                className="flex-1"
                                                                classNames={{
                                                                    label: 'text-default-700 dark:text-default-300',
                                                                    input: [
                                                                        'text-default-700 !text-default-700',
                                                                        'dark:!text-default-300',
                                                                        'placeholder:text-default-700',
                                                                        'dark:placeholder:text-default-300',
                                                                        '[&.group-data-\[has-value\=true\]\:text-default-foreground]:text-default-700',
                                                                        'dark:[&.group-data-\[has-value\=true\]\:text-default-foreground]:text-default-300',
                                                                    ],
                                                                    innerWrapper: 'bg-transparent',
                                                                    inputWrapper: [
                                                                        'bg-default-100 dark:bg-default-50/10',
                                                                        'hover:bg-default-200 dark:hover:bg-default-50/20',
                                                                        'group-data-[focus=true]:bg-default-100 dark:group-data-[focus=true]:bg-default-50/30',
                                                                        '!border-0',
                                                                    ],
                                                                }}
                                                                isDisabled={readOnly}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Add Condition Button */}
                                        {!readOnly && (
                                            <Button
                                                size="sm"
                                                color="primary"
                                                variant="light"
                                                onPress={() => addCondition(routeKey)}
                                                startContent={
                                                    <Icon
                                                        icon="solar:add-circle-linear"
                                                        width={18}
                                                        className="text-foreground"
                                                    />
                                                }
                                                className="text-foreground"
                                            >
                                                Add Condition
                                            </Button>
                                        )}

                                        {/* Route Output Handle */}
                                        <div className={`${styles.handleRow} w-full justify-end mt-2`}>
                                            <div className="align-center flex flex-grow flex-shrink mr-2">
                                                <span className="text-sm font-medium ml-auto text-foreground">
                                                    {routeKey}
                                                </span>
                                            </div>
                                            <Handle
                                                type="source"
                                                position={Position.Right}
                                                id={routeKey}
                                                className={`${styles.handle} ${styles.handleRight} ${isCollapsed ? styles.collapsedHandleOutput : ''}`}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            {/* Add Route Button */}
                            {!readOnly && (
                                <Button
                                    size="sm"
                                    color="primary"
                                    variant="light"
                                    onPress={addRoute}
                                    startContent={
                                        <Icon icon="solar:add-circle-linear" width={18} className="text-foreground" />
                                    }
                                    className="text-foreground"
                                >
                                    Add Route
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Output handles when collapsed */}
                {isCollapsed &&
                    nodeConfig?.route_map &&
                    Object.keys(nodeConfig.route_map).map((routeKey) => (
                        <div key={routeKey} className={`${styles.handleRow} w-full justify-end mt-2`}>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={routeKey}
                                className={`${styles.handle} ${styles.handleRight} ${styles.collapsedHandleOutput}`}
                            />
                        </div>
                    ))}
            </div>
            <NodeOutputModal
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                title={nodeData?.title || 'Node Output'}
                data={nodeData}
            />
        </BaseNode>
    )
}
