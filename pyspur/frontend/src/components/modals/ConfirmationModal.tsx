import React from 'react'
import {
    Button,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from '@heroui/react'

interface ConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    isDanger?: boolean
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalContent>
                <ModalHeader>{title}</ModalHeader>
                <ModalBody>
                    <p>{message}</p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        {cancelText}
                    </Button>
                    <Button
                        color={isDanger ? 'danger' : 'primary'}
                        onPress={() => {
                            onConfirm()
                            onClose()
                        }}
                    >
                        {confirmText}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default ConfirmationModal