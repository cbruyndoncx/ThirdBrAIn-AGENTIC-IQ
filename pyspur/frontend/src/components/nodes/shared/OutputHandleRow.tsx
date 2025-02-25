import React from 'react'
import { Handle, Position } from '@xyflow/react'
import styles from '../DynamicNode.module.css'

interface OutputHandleRowProps {
    id: string
    keyName: string
    isCollapsed: boolean
}

export const OutputHandleRow: React.FC<OutputHandleRowProps> = ({ id, keyName, isCollapsed }) => {
    return (
        <div
            className={`${styles.handleRow} w-full justify-end`}
            key={`output-${keyName}`}
            id={`output-${keyName}-row`}
        >
            {!isCollapsed && (
                <div
                    className="align-center flex flex-grow flex-shrink mr-[0.5rem] max-w-full overflow-hidden"
                    id={`output-${keyName}-label`}
                >
                    <span
                        className={`${styles.handleLabel} text-sm font-medium cursor-pointer hover:text-primary
                            ml-auto overflow-hidden text-ellipsis whitespace-nowrap`}
                    >
                        {keyName}
                    </span>
                </div>
            )}
            <div className="border-l border-gray-200 h-full mx-0" />
            <div className={`${styles.handleCell} ${styles.outputHandleCell}`} id={`output-${keyName}-handle`}>
                <Handle
                    type="source"
                    position={Position.Right}
                    id={String(id)}
                    className={`${styles.handle} ${styles.handleRight} ${isCollapsed ? styles.collapsedHandleOutput : ''}`}
                    isConnectable={!isCollapsed}
                />
            </div>
        </div>
    )
} 