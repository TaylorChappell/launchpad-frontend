import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
import { RuntimeProvider, WalletProvider } from "./context";
import "./styles.css";
createRoot(document.getElementById("root")!).render(<StrictMode><RuntimeProvider><WalletProvider><App/><Toaster theme="dark" richColors/></WalletProvider></RuntimeProvider></StrictMode>);
