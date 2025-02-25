import { Button, ButtonGroup, Tooltip } from '@heroui/react'
import { Icon } from '@iconify/react'
import { MiniMap } from '@xyflow/react'
import { useTheme } from 'next-themes'
import { memo } from 'react'
import { useModeStore } from '../../../store/modeStore'
import UndoRedo from './UndoRedo'
import ZoomInOut from './ZoomInOut'

interface OperatorProps {
    handleLayout: () => void
    handleDownloadImage: () => void
}

const Operator: React.FC<OperatorProps> = ({ handleLayout, handleDownloadImage }) => {
    const mode = useModeStore((state) => state.mode)
    const setMode = useModeStore((state) => state.setMode)
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <>
            <MiniMap
                style={{
                    width: 102,
                    height: 72,
                }}
                nodeColor={() => (isDark ? '#777' : '#eee')}
                className={`
                    bg-content2
                    dark:bg-content2/10
                    !absolute
                    !left-4
                    !bottom-14
                    z-[9]
                    !m-0
                    !w-[102px]
                    !h-[72px]
                    !border-[0.5px]
                    !border-default-200
                    !rounded-lg
                    !shadow-lg
                `}
            />
            <div className="flex items-center mt-1 gap-2 absolute left-4 bottom-4 z-[9]">
                <ZoomInOut />
                <ButtonGroup>
                    <Tooltip
                        content={
                            <div className="px-1 py-2">
                                <div className="text-small font-bold">Select</div>
                                <div className="text-tiny">Press <kbd>V</kbd></div>
                            </div>
                        }
                        placement="bottom"
                    >
                        <Button
                            size="sm"
                            isIconOnly
                            onPress={() => setMode('pointer' as any)}
                            className="bg-background"
                        >
                            <Icon
                                className={mode === ('pointer' as any) ? 'text-foreground' : 'text-foreground/60'}
                                icon={mode === ('pointer' as any) ? 'solar:cursor-bold' : 'solar:cursor-linear'}
                                width={16}
                            />
                        </Button>
                    </Tooltip>
                    <Tooltip
                        content={
                            <div className="px-1 py-2">
                                <div className="text-small font-bold">Pan</div>
                                <div className="text-tiny">Press <kbd>Space</kbd></div>
                            </div>
                        }
                        placement="bottom"
                    >
                        <Button size="sm" isIconOnly onPress={() => setMode('hand')} className="bg-background">
                            <Icon
                                className={mode === 'hand' ? 'text-foreground' : 'text-foreground/60'}
                                icon={mode === 'hand' ? 'solar:hand-shake-bold' : 'solar:hand-shake-linear'}
                                width={16}
                            />
                        </Button>
                    </Tooltip>
                    <Tooltip
                        content={
                            <div className="px-1 py-2">
                                <div className="text-small font-bold">Layout Nodes</div>
                                <div className="text-tiny">Press <kbd>{navigator.platform.includes('Mac') ? '⌘ CMD' : 'Ctrl'}</kbd>+<kbd>L</kbd></div>
                            </div>
                        }
                        placement="bottom"
                    >
                        <Button size="sm" isIconOnly onPress={handleLayout} className="bg-background">
                            <Icon className="text-foreground" icon="solar:ruler-angular-linear" width={16} />
                        </Button>
                    </Tooltip>
                </ButtonGroup>
                <ButtonGroup>
                    <UndoRedo />
                </ButtonGroup>
            </div>
        </>
    )
}

export default memo(Operator)
