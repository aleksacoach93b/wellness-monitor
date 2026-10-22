"use client";
import { createContext, useContext } from "react";
export type OpsAccess = {
  readOnly: boolean;
  apiBase: string;
  request: typeof fetch;
};
export const OpsAccessContext = createContext<OpsAccess>({
  readOnly: false,
  apiBase: "/api/ops",
  request: (...args) => fetch(...args),
});
export const useOpsAccess = () => useContext(OpsAccessContext);
