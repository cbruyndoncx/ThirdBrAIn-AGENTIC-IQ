import React from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { Card, Button, Tooltip } from '@heroui/react'
import { Icon } from '@iconify/react'

const ZoomInOut: React.FC = () => {
    const { zoomIn, zoomOut } = useReactFlow()
    const { zoom } = useViewport()

    const handleZoomIn = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        zoomIn()
    }

    const handleZoomOut = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        zoomOut()
    }

    return (
        <Card className="flex items-center justify-center shadow-none bg-background">
            <div className="zoom-controls flex items-center gap-2">
                <Tooltip
                    content={
                        <div className="px-1 py-2">
                            <div className="text-small font-bold">Zoom Out</div>
                            <div className="text-tiny">Press <kbd>{navigator.platform.includes('Mac') ? '⌘ CMD' : 'Ctrl'}</kbd>+<kbd>-</kbd></div>
                        </div>
                    }
                    placement="bottom"
                >
                    <Button isIconOnly variant="light" onClick={handleZoomOut}>
                        <Icon icon="solar:minimize-square-linear" width={16} className="text-foreground" />
                    </Button>
                </Tooltip>
                <span className="text-sm text-foreground">{(zoom * 100).toFixed(0)}%</span>
                <Tooltip
                    content={
                        <div className="px-1 py-2">
                            <div className="text-small font-bold">Zoom In</div>
                            <div className="text-tiny">Press <kbd>{navigator.platform.includes('Mac') ? '⌘ CMD' : 'Ctrl'}</kbd>+<kbd>+</kbd></div>
                        </div>
                    }
                    placement="bottom"
                >
                    <Button isIconOnly variant="light" onClick={handleZoomIn}>
                        <Icon icon="solar:maximize-square-linear" width={16} className="text-foreground" />
                    </Button>
                </Tooltip>
            </div>
        </Card>
    )
}

export default ZoomInOut
