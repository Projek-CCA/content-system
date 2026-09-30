import { useAppState } from '../state/AppState';
import { Modal } from './Modal';

export function ConfirmDialog() {
  const { pendingConfirm, resolveConfirm } = useAppState();
  if (!pendingConfirm) return null;
  return (
    <Modal title="Are you sure?" onClose={() => resolveConfirm(false)}>
      <p className="confirm__message">{pendingConfirm.message}</p>
      <div className="form__actions">
        <button className="btn btn--ghost" data-autofocus onClick={() => resolveConfirm(false)}>
          Cancel
        </button>
        <button className="btn btn--primary" onClick={() => resolveConfirm(true)}>
          {pendingConfirm.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
