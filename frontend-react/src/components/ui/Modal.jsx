import { Sheet } from './Sheet';

/** Older name for Sheet, kept so existing callers (open/isOpen, actions) keep working. */
export function Modal({ open, isOpen, title, children, actions, onClose }) {
  return (
    <Sheet
      open={Boolean(open ?? isOpen)}
      onClose={onClose}
      title={title}
      footer={actions ? <div className="flex items-center justify-end gap-3">{actions}</div> : null}
    >
      {children}
    </Sheet>
  );
}
