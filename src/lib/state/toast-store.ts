import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";
export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone, action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = "info", action) => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { id, message, tone, action }] });
    setTimeout(() => get().dismiss(id), action ? 7000 : 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (message: string, tone?: ToastTone, action?: Toast["action"]) =>
  useToasts.getState().push(message, tone, action);
