import React from 'react';
import Modal from './Modal.jsx';

// Generic confirmation modal. `danger` styles the confirm button as destructive.
export default function ConfirmDialog({
  title = 'Er du sikker?',
  message,
  confirmLabel = 'Ja',
  cancelLabel = 'Annuller',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal title={title} onClose={onCancel} testId="confirm-dialog">
      {message && <p className="confirm-message">{message}</p>}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          data-testid="confirm-ok"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
