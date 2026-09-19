import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";

const Markets = lazy(() => import("./pages/Markets").then(module => ({ default: module.Markets })));
const Create = lazy(() => import("./pages/Create").then(module => ({ default: module.Create })));
const Studio = lazy(() => import("./pages/Studio").then(module => ({ default: module.Studio })));
const AccountSettings = lazy(() => import("./pages/Account").then(module => ({ default: module.AccountSettings })));
const Profile = lazy(() => import("./pages/Account").then(module => ({ default: module.Profile })));
const Token = lazy(() => import("./pages/Token").then(module => ({ default: module.Token })));
const Portfolio = lazy(() => import("./pages/Portfolio").then(module => ({ default: module.Portfolio })));
const Rewards = lazy(() => import("./pages/Rewards").then(module => ({ default: module.Rewards })));
const Analytics = lazy(() => import("./pages/Analytics").then(module => ({ default: module.Analytics })));
const HowItWorks = lazy(() => import("./pages/HowItWorks").then(module => ({ default: module.HowItWorks })));
const Terms = lazy(() => import("./pages/Legal").then(module => ({ default: module.Terms })));
const Privacy = lazy(() => import("./pages/Legal").then(module => ({ default: module.Privacy })));
const CreatorManage = lazy(() => import("./pages/CreatorManage").then(module => ({ default: module.CreatorManage })));
const Admin = lazy(() => import("./pages/Admin").then(module => ({ default: module.Admin })));
const Developers = lazy(() => import("./pages/Developers").then(module => ({ default: module.Developers })));

export function App() {
  return <HashRouter><Layout><Suspense fallback={<main className="page"><div className="page-loading">Loading AQUA…</div></main>}><Routes><Route path="/" element={<Markets/>}/><Route path="/studio" element={<Studio/>}/><Route path="/settings" element={<AccountSettings/>}/><Route path="/settings/:section" element={<AccountSettings/>}/><Route path="/profile/:wallet" element={<Profile/>}/><Route path="/create" element={<Create/>}/><Route path="/token/:id" element={<Token/>}/><Route path="/manage/:id" element={<CreatorManage/>}/><Route path="/portfolio" element={<Portfolio/>}/><Route path="/rewards" element={<Rewards/>}/><Route path="/analytics" element={<Analytics/>}/><Route path="/how-it-works" element={<HowItWorks/>}/><Route path="/developers" element={<Developers/>}/><Route path="/terms" element={<Terms/>}/><Route path="/privacy" element={<Privacy/>}/><Route path="/admin" element={<Admin/>}/></Routes></Suspense></Layout></HashRouter>;
}
