import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; message: string };

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || 'Unknown runtime failure' };
  }

  componentDidCatch(error: Error) {
    console.error('Root render failure:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-screen">
          <section>
            <h1>ROOTACCESS RECOVERY MODE</h1>
            <p>The app hit a runtime fault instead of loading a white screen.</p>
            <p>Error: {this.state.message}</p>
            <p>Hard refresh after deploy update. If this persists, check browser console + GitHub Pages path.</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
