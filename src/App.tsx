import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";

const Markets = lazy(() => import("./pages/Markets").then(module => ({ default: module.Markets })));
const Create = lazy(() => import("./pages/Create").then(module => ({ default: module.Create })));
const Token = lazy(() => import("./pages/Token").then(module => ({ default: module.Token })));
const Portfolio = lazy(() => import("./pages/Portfolio").then(module => ({ default: module.Portfolio })));
const Rewards = lazy(() => import("./pages/Rewards").then(module => ({ default: module.Rewards })));
const HowItWorks = lazy(() => import("./pages/HowItWorks").then(module => ({ default: module.HowItWorks })));
const Terms = lazy(() => import("./pages/Legal").then(module => ({ default: module.Terms })));
const Privacy = lazy(() => import("./pages/Legal").then(module => ({ default: module.Privacy })));
const CreatorManage = lazy(() => import("./pages/CreatorManage").then(module => ({ default: module.CreatorManage })));
const Admin = lazy(() => import("./pages/Admin").then(module => ({ default: module.Admin })));

export function App() {
  return <HashRouter><Layout><Suspense fallback={<main className="page"><div className="page-loading">Loading AQUA…</div></main>}><Routes><Route path="/" element={<Markets/>}/><Route path="/create" element={<Create/>}/><Route path="/token/:id" element={<Token/>}/><Route path="/manage/:id" element={<CreatorManage/>}/><Route path="/portfolio" element={<Portfolio/>}/><Route path="/rewards" element={<Rewards/>}/><Route path="/how-it-works" element={<HowItWorks/>}/><Route path="/terms" element={<Terms/>}/><Route path="/privacy" element={<Privacy/>}/><Route path="/admin" element={<Admin/>}/></Routes></Suspense></Layout></HashRouter>;
}
