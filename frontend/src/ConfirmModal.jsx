import React from "react";

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <div className="modal" role="document">
        <h4 id="confirm-title">{title}</h4>
        <p id="confirm-desc">{message}</p>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="delete-btn" onClick={onConfirm} type="button">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
