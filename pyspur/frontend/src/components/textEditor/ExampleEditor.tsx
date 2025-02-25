import React, { useState } from 'react'
import { Button, Tab, Tabs } from '@heroui/react'
import TextEditor from './TextEditor'
import { ExampleEditorProps } from '../../types/fewShot'

const ExampleEditor: React.FC<ExampleEditorProps> = ({
    nodeID,
    exampleIndex,
    example,
    onSave,
    onDiscard,
    onContentChange,
}) => {
    const [activeTab, setActiveTab] = useState<'input' | 'output'>('input')

    return (
        <div className="w-full px-4 py-10 my-10 bg-content1 dark:bg-content1 rounded-lg shadow-sm">
            <div className="mb-5">
                <div className="flex w-full flex-col items-center">
                    <Tabs
                        aria-label="Input/Output Options"
                        selectedKey={activeTab}
                        onSelectionChange={(key) => setActiveTab(key as 'input' | 'output')}
                    >
                        <Tab key="input" title="Input" />
                        <Tab key="output" title="Output" />
                    </Tabs>
                </div>
            </div>

            <div className="mb-2 font-medium text-foreground">
                Example {exampleIndex + 1} {activeTab}
            </div>
            <TextEditor
                key={`${activeTab}-${exampleIndex}`}
                content={example[activeTab] || ''}
                setContent={(content) => onContentChange(content, activeTab)}
                isEditable={true}
                fieldTitle={`Example ${exampleIndex + 1} ${activeTab}`}
                nodeID={nodeID}
                fieldName={`few_shot_examples[${exampleIndex}][${activeTab}]`}
            />

            <div className="mt-4 flex gap-2">
                <Button onPress={onDiscard} color="primary" variant="flat">
                    Discard
                </Button>
                <Button onPress={onSave} color="primary" variant="solid">
                    Save
                </Button>
            </div>
        </div>
    )
}

export default ExampleEditor