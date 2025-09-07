import React from "react";

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h4>{title}</h4>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="delete-btn" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
