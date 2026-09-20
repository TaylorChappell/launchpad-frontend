import { ErrorBoundary } from "./components/ErrorBoundary";
import { Suspense } from "react";
import { lazyWithRecovery as lazy } from "./components/LazyRecovery";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";

const Markets = lazy(() => import("./pages/Markets").then(module => ({ default: module.Markets })));
const Create = lazy(() => import("./pages/Create").then(module => ({ default: module.Create })));
const Studio = lazy(() => import("./pages/Studio").then(module => ({ default: module.Studio })));
const Token = lazy(() => import("./pages/Token").then(module => ({ default: module.Token })));
const Portfolio = lazy(() => import("./pages/Portfolio").then(module => ({ default: module.Portfolio })));
const Analytics = lazy(() => import("./pages/Analytics").then(module => ({ default: module.Analytics })));
const HowItWorks = lazy(() => import("./pages/HowItWorks").then(module => ({ default: module.HowItWorks })));
const Terms = lazy(() => import("./pages/Legal").then(module => ({ default: module.Terms })));
const Privacy = lazy(() => import("./pages/Legal").then(module => ({ default: module.Privacy })));
const CreatorManage = lazy(() => import("./pages/CreatorManage").then(module => ({ default: module.CreatorManage })));
const Admin = lazy(() => import("./pages/Admin").then(module => ({ default: module.Admin })));
const Developers = lazy(() => import("./pages/Developers").then(module => ({ default: module.Developers })));

function LegacyStudioRedirect() {
  const { search } = useLocation();
  return <Navigate replace to={{ pathname: "/studio", search }} />;
}

function RouteRecovery({children}:{children:import("react").ReactNode}){const {pathname}=useLocation();return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;}

export function App() {
  return <HashRouter><ErrorBoundary><Layout><RouteRecovery><Suspense fallback={<main className="page"><div className="page-loading">Loading AQUA…</div></main>}><Routes><Route path="/" element={<Markets/>}/><Route path="/studio" element={<Studio/>}/><Route path="/updates/atlantis-free" element={<Navigate replace to="/studio"/>}/><Route path="/integrations" element={<LegacyStudioRedirect/>}/><Route path="/settings/*" element={<LegacyStudioRedirect/>}/><Route path="/profile/:wallet" element={<LegacyStudioRedirect/>}/><Route path="/create" element={<Create/>}/><Route path="/token/:id" element={<Token/>}/><Route path="/manage/:id" element={<CreatorManage/>}/><Route path="/portfolio" element={<Portfolio/>}/><Route path="/rewards" element={<Navigate replace to="/portfolio?tab=rewards"/>}/><Route path="/analytics" element={<Analytics/>}/><Route path="/how-it-works" element={<HowItWorks/>}/><Route path="/developers" element={<Developers/>}/><Route path="/terms" element={<Terms/>}/><Route path="/privacy" element={<Privacy/>}/><Route path="/admin" element={<Admin/>}/><Route path="/status" element={<Navigate replace to="/"/>}/><Route path="*" element={<main className="page"><section className="empty-state"><h1>Page not found</h1><p>This AQUA page has moved or does not exist.</p><a className="primary" href="#/">Explore markets</a></section></main>}/></Routes></Suspense></RouteRecovery></Layout></ErrorBoundary></HashRouter>;
}
