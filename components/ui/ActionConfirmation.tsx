'use client'

import { Modal, ModalBody, ModalFooter, ModalHeader } from './Modal'
import { Button } from './Button'
import { Notice } from './Notice'

export function ActionConfirmation({ message, onClose }: { message: string; onClose: () => void }) {
  return <Modal isOpen onClose={onClose} ariaLabel="Confirmation" size="sm">
    <ModalHeader title="Confirmation" onClose={onClose} />
    <ModalBody><Notice variant="success">{message}</Notice></ModalBody>
    <ModalFooter><Button onClick={onClose}>Done</Button></ModalFooter>
  </Modal>
}