import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, ThemeToaster } from "./theme";
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
createRoot(document.getElementById("root")!).render(<StrictMode><ThemeProvider><RuntimeProvider><WalletProvider><App/><ThemeToaster/></WalletProvider></RuntimeProvider></ThemeProvider></StrictMode>);


import "./x-identity.css";
import "./mobile.css";

import "./experience.css";
import "./components/market-card.css";

import "./components/candles.css";
import "./theme.css";
