import { createContext } from "react";

export const SidebarToggleContext = createContext<{
  isOpen: boolean;
  toggle: () => void;
}>({ isOpen: true, toggle: () => {} });
