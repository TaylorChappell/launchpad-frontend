import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { App } from "./App";
import { RuntimeProvider, WalletProvider } from "./context";
import "./styles.css";
import "./polish.css";
import "./aqua-theme.css";

import "./market.css";
import "./design-system.css";
import "./holder-workspace.css";
import "./creator-dashboard.css";
import "./components/dialog-motion.css";
createRoot(document.getElementById("root")!).render(<StrictMode><RuntimeProvider><WalletProvider><App/><Toaster theme="light" richColors/></WalletProvider></RuntimeProvider></StrictMode>);

