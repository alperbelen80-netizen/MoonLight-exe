import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// NOTE: React.StrictMode is intentionally omitted because it double-invokes
// useEffect hooks in dev mode, which interferes with our zustand fetch guards
// and caused the Dashboard to show a perpetual loading spinner when the
// second (strict-mode) invocation was blocked by the isLoading flag while the
// first invocation's promise was still in flight. In production builds
// StrictMode does not double-invoke effects, so this has no runtime impact.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
void React;
