import React, { useState, useEffect } from 'react'
import {
    Card,
    CardBody,
    CardHeader,
    Button,
    Input,
    Divider,
    Chip,
    Tooltip,
    Tabs,
    Tab,
    Textarea,
    Spinner,
    Select,
    SelectItem,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from '@heroui/react'
import { Icon } from '@iconify/react'
import TextEditor from '../textEditor/TextEditor'
import { previewChunk } from '@/utils/api'
import type { ChunkPreviewResponseSchema as ChunkPreviewResponse, ChunkPreviewSchema as ChunkPreview } from '@/types/api_types/ragSchemas'

interface ChunkTemplate {
    enabled: boolean
    template: string
    metadata_template: { type: string } | Record<string, string>
}

interface ChunkEditorProps {
    template: ChunkTemplate
    onTemplateChange: (template: ChunkTemplate) => void
    chunkingConfig: {
        chunk_token_size: number
        min_chunk_size_chars: number
        min_chunk_length_to_embed: number
    }
    files?: File[]
}

export const ChunkEditor: React.FC<ChunkEditorProps> = ({ template, onTemplateChange, chunkingConfig, files }) => {
    const [isPreviewLoading, setIsPreviewLoading] = useState(false)
    const [previewResult, setPreviewResult] = useState<ChunkPreviewResponse | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedChunk, setSelectedChunk] = useState<ChunkPreview | null>(null)

    // Reset selected file when files prop changes
    useEffect(() => {
        if (files?.length) {
            setSelectedFile(files[0])
        } else {
            setSelectedFile(null)
        }
    }, [files])

    const handlePreview = async () => {
        try {
            setIsPreviewLoading(true)

            if (!selectedFile) {
                throw new Error('No file selected for preview')
            }

            const result = await previewChunk(selectedFile, {
                ...chunkingConfig,
                template,
            })
            setPreviewResult(result)
        } catch (error) {
            console.error('Error getting preview:', error)
        } finally {
            setIsPreviewLoading(false)
        }
    }

    return (
        <Card className="w-full">
            <CardHeader className="flex justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-medium font-semibold">Chunk Template Editor</h3>
                    <Tooltip content="Configure how your chunks will be formatted">
                        <Icon icon="solar:info-circle-linear" className="text-default-400" />
                    </Tooltip>
                </div>
            </CardHeader>
            <Divider />
            <CardBody>
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-medium font-semibold">Chunk Template</h3>
                        <Tooltip content="Use {{ text }} to reference the chunk text. You can add HTML formatting and additional text.">
                            <Icon icon="solar:info-circle-linear" className="text-default-400" />
                        </Tooltip>
                    </div>
                    <TextEditor
                        nodeID="chunk-template"
                        fieldName="template"
                        content={template.template}
                        setContent={(content) => onTemplateChange({ ...template, template: content })}
                        inputSchema={['text']}
                    />

                    <Divider />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-medium font-semibold">Preview</h3>
                                <Tooltip content="See how your template will be applied to chunks">
                                    <Icon icon="solar:info-circle-linear" className="text-default-400" />
                                </Tooltip>
                            </div>
                            <div className="flex items-center gap-2">
                                {files && files.length > 0 && (
                                    <Select
                                        size="sm"
                                        selectedKeys={selectedFile ? [selectedFile.name] : []}
                                        onSelectionChange={(keys) => {
                                            const selectedKey = Array.from(keys)[0]?.toString()
                                            const file = files.find((f) => f.name === selectedKey)
                                            if (file) setSelectedFile(file)
                                        }}
                                    >
                                        {files.map((file) => (
                                            <SelectItem key={file.name} value={file.name}>
                                                {file.name}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                )}
                                <Button
                                    size="sm"
                                    color="primary"
                                    variant="flat"
                                    startContent={<Icon icon="solar:play-circle-linear" />}
                                    onPress={handlePreview}
                                    isLoading={isPreviewLoading}
                                    isDisabled={isPreviewLoading || !selectedFile}
                                >
                                    Generate Preview
                                </Button>
                            </div>
                        </div>

                        {previewResult && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <h4 className="text-small font-semibold">Preview Chunks</h4>
                                    <Chip size="sm" variant="flat">
                                        {previewResult.total_chunks} chunks total
                                    </Chip>
                                </div>

                                {previewResult.chunks.map((chunk, index) => (
                                    <Card key={index} className="bg-content2">
                                        <CardBody className="gap-4">
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-small font-semibold">
                                                        Chunk {chunk.chunk_index}
                                                        {chunk.chunk_index === 1 && ' (Start)'}
                                                        {chunk.chunk_index === previewResult.total_chunks && ' (End)'}
                                                        {chunk.chunk_index !== 1 &&
                                                            chunk.chunk_index !== previewResult.total_chunks &&
                                                            ' (Middle)'}
                                                    </h4>
                                                    <Button
                                                        size="sm"
                                                        variant="flat"
                                                        onPress={() => setSelectedChunk(chunk)}
                                                    >
                                                        View Full Text
                                                    </Button>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-small font-semibold">Processed Result</h4>
                                                <div
                                                    className="prose dark:prose-invert max-w-none mt-2 max-h-[200px] overflow-hidden"
                                                    dangerouslySetInnerHTML={{
                                                        __html: chunk.processed_text,
                                                    }}
                                                />
                                            </div>

                                            <Divider />

                                            <div>
                                                <h4 className="text-small font-semibold">Metadata</h4>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {Object.entries(chunk.metadata).map(([key, value]) => (
                                                        <Chip key={key} size="sm" variant="flat">
                                                            {key}: {value}
                                                        </Chip>
                                                    ))}
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                ))}

                                <Modal isOpen={!!selectedChunk} onClose={() => setSelectedChunk(null)} size="full">
                                    <ModalContent>
                                        {(onClose) => (
                                            <>
                                                <ModalHeader>
                                                    <h3>Chunk {selectedChunk?.chunk_index} Full Text</h3>
                                                </ModalHeader>
                                                <ModalBody>
                                                    <div
                                                        className="prose dark:prose-invert max-w-none"
                                                        dangerouslySetInnerHTML={{
                                                            __html: selectedChunk?.processed_text || '',
                                                        }}
                                                    />
                                                </ModalBody>
                                                <ModalFooter>
                                                    <Button onPress={onClose}>Close</Button>
                                                </ModalFooter>
                                            </>
                                        )}
                                    </ModalContent>
                                </Modal>
                            </div>
                        )}

                        {!previewResult && !isPreviewLoading && (
                            <Card className="bg-default-50">
                                <CardBody className="py-8">
                                    <div className="flex flex-col items-center gap-2 text-default-500">
                                        <Icon icon="solar:document-text-linear" width={32} />
                                        <p>No preview generated yet</p>
                                        <p className="text-small text-center">
                                            Click &ldquo;Generate Preview&rdquo; to see how your template will be
                                            applied to chunks
                                        </p>
                                    </div>
                                </CardBody>
                            </Card>
                        )}
                    </div>
                </div>
            </CardBody>
        </Card>
    )
}

export default ChunkEditor
