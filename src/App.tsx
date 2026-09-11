import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Markets } from "./pages/Markets";
import { Create } from "./pages/Create";
import { Token } from "./pages/Token";
import { Portfolio } from "./pages/Portfolio";
import { Rewards } from "./pages/Rewards";
import { HowItWorks } from "./pages/HowItWorks";
export function App(){return <HashRouter><Layout><Routes><Route path="/" element={<Markets/>}/><Route path="/create" element={<Create/>}/><Route path="/token/:id" element={<Token/>}/><Route path="/portfolio" element={<Portfolio/>}/><Route path="/rewards" element={<Rewards/>}/><Route path="/how-it-works" element={<HowItWorks/>}/></Routes></Layout></HashRouter>}
