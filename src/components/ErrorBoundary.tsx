import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="page"><section className="empty-state" role="alert"><h1>This page could not load</h1><p>Your wallet and saved projects are unchanged. Reload to try again.</p><button className="primary" onClick={() => window.location.reload()}>Reload page</button><a href="#/" onClick={() => this.setState({ failed: false })}>Back to markets</a></section></main>;
    return this.props.children;
  }
}
