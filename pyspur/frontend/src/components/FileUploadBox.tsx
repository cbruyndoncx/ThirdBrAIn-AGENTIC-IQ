import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardBody, Button, Chip } from '@heroui/react'
import { Upload, X, CheckCircle2 } from 'lucide-react'

interface FileUploadBoxProps {
    onFilesChange: (files: File[]) => void | Promise<void>
    multiple?: boolean
    // New props for file type configuration
    acceptedFileTypes?: {
        [key: string]: string[]
    }
    supportedFormatsMessage?: string
}

const DEFAULT_ACCEPTED_FILE_TYPES = {
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
}

const DEFAULT_FORMATS_MESSAGE = 'Supported formats: PDF, TXT, MD, DOCX'

const FileUploadBox: React.FC<FileUploadBoxProps> = ({
    onFilesChange,
    multiple = true,
    acceptedFileTypes = DEFAULT_ACCEPTED_FILE_TYPES,
    supportedFormatsMessage = DEFAULT_FORMATS_MESSAGE,
}) => {
    const [files, setFiles] = useState<File[]>([])
    const [showSuccess, setShowSuccess] = useState(false)

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            // In single file mode, only keep the latest file
            const newFiles = multiple ? [...files, ...acceptedFiles] : [acceptedFiles[0]]
            setFiles(newFiles)
            await onFilesChange(newFiles)

            // Show success feedback
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 3000) // Hide after 3 seconds
        },
        [files, onFilesChange, multiple]
    )

    const removeFile = async (index: number) => {
        const newFiles = files.filter((_, i) => i !== index)
        setFiles(newFiles)
        // Only trigger onFilesChange if we have files to upload
        if (newFiles.length > 0) {
            await onFilesChange(newFiles)
        }
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: acceptedFileTypes,
        multiple, // Allow multiple files only when multiple prop is true
    })

    return (
        <div className="min-h-[120px] max-h-[300px] space-y-2">
            <div {...getRootProps()}>
                <input {...getInputProps()} />
                <Card
                    className={`border-2 border-dashed transition-colors cursor-pointer min-h-[120px]
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-default-200 hover:border-primary'}`}
                >
                    <CardBody className="py-4">
                        <div className="flex flex-col items-center gap-2">
                            {showSuccess ? (
                                <CheckCircle2 className="w-8 h-8 text-success animate-in fade-in" />
                            ) : (
                                <Upload className={`w-8 h-8 ${isDragActive ? 'text-primary' : 'text-default-400'}`} />
                            )}
                            <div className="text-center">
                                <p className="text-default-500 text-sm">
                                    {isDragActive
                                        ? 'Drop the file here'
                                        : `Drag and drop ${multiple ? 'files' : 'a file'} here or click to browse`}
                                </p>
                                <p className="text-xs text-default-400 mt-1">{supportedFormatsMessage}</p>
                                {!multiple && files.length > 0 && (
                                    <p className="text-xs text-warning mt-1">
                                        New file upload will replace the existing file
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            {files.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            <p className="text-sm font-medium text-success">
                                {multiple ? `${files.length} files uploaded` : 'File uploaded successfully'}
                            </p>
                        </div>
                        {!multiple && (
                            <Chip size="sm" variant="flat" color="warning">
                                Single file mode
                            </Chip>
                        )}
                    </div>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto">
                        {files.map((file, index) => (
                            <Card key={index} className="bg-default-50">
                                <CardBody className="py-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                                            <span className="text-xs text-default-400">
                                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                            </span>
                                        </div>
                                        <Button isIconOnly size="sm" variant="light" onPress={() => removeFile(index)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default FileUploadBox
