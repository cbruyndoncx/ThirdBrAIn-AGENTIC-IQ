import type { FC } from 'react'
import { memo } from 'react'
import { Button, Tooltip } from '@heroui/react'
import { Icon } from '@iconify/react'
import { useDispatch, useSelector } from 'react-redux'
import { useHotkeys } from 'react-hotkeys-hook'
import { undo, redo } from '../../../store/flowSlice'
import { RootState } from '../../../store/store'

const UndoRedo: FC = () => {
    const dispatch = useDispatch()
    const history = useSelector((state: RootState) => state.flow.history)

    const handleUndo = () => {
        if (history.past.length > 0) {
            dispatch(undo())
        }
    }

    const handleRedo = () => {
        if (history.future.length > 0) {
            dispatch(redo())
        }
    }

    useHotkeys(
        ['ctrl+z', 'meta+z'],
        (event) => {
            event.preventDefault()
            handleUndo()
        },
        [handleUndo]
    )

    useHotkeys(
        ['ctrl+shift+z', 'meta+shift+z', 'ctrl+y', 'meta+y'],
        (event) => {
            event.preventDefault()
            handleRedo()
        },
        [handleRedo]
    )

    return (
        <>
            <Tooltip
                content={
                    <div className="px-1 py-2">
                        <div className="text-small font-bold">Undo</div>
                        <div className="text-tiny">Press <kbd>{navigator.platform.includes('Mac') ? '⌘ CMD' : 'Ctrl'}</kbd>+<kbd>Z</kbd></div>
                    </div>
                }
                placement="bottom"
            >
                <Button
                    size="sm"
                    isIconOnly
                    className="bg-background"
                    onClick={handleUndo}
                    isDisabled={history.past.length === 0}
                >
                    <Icon icon="solar:undo-left-linear" width={16} className="text-foreground" />
                </Button>
            </Tooltip>
            <Tooltip
                content={
                    <div className="px-1 py-2">
                        <div className="text-small font-bold">Redo</div>
                        <div className="text-tiny">Press <kbd>{navigator.platform.includes('Mac') ? '⌘ CMD' : 'Ctrl'}</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></div>
                        <div className="text-tiny">or <kbd>{navigator.platform.includes('Mac') ? '⌘ CMD' : 'Ctrl'}</kbd>+<kbd>Y</kbd></div>
                    </div>
                }
                placement="bottom"
            >
                <Button
                    size="sm"
                    isIconOnly
                    className="bg-background"
                    onClick={handleRedo}
                    isDisabled={history.future.length === 0}
                >
                    <Icon icon="solar:undo-right-linear" width={16} className="text-foreground" />
                </Button>
            </Tooltip>
        </>
    )
}

export default memo(UndoRedo)
