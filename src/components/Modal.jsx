import React from 'react';

// Simple full-screen overlay modal. Clicking the backdrop closes (via onClose).
export default function Modal({ title, children, onClose, testId }) {
  return (
    <div className="modal-backdrop" onClick={onClose} data-testid={testId}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {title && (
          <div className="modal-header">
            <h2>{title}</h2>
            <button className="btn btn-icon" onClick={onClose} aria-label="Luk">
              ✕
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
