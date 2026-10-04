import { createContext, useContext, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmValue = (message: string, title?: string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmValue>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; title: string; resolve: (v: boolean) => void } | null>(null);

  const confirm: ConfirmValue = (message, title = "Please confirm") => new Promise(resolve => setState({ message, title, resolve }));

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-backdrop center-modal" role="presentation" onMouseDown={() => close(false)}>
          <div className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={e => e.stopPropagation()}>
            <span className="warning-icon"><AlertTriangle /></span>
            <h2 id="confirm-title">{state.title}</h2>
            <p>{state.message}</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => close(false)}>Go back</button>
              <button className="primary" onClick={() => close(true)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
