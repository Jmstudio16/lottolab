import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Fix ResizeObserver loop error (known issue with Radix UI components)
// This error is benign and doesn't affect functionality
const resizeObserverError = (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
      e.message === 'ResizeObserver loop limit exceeded') {
    const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
    const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
    if (resizeObserverErrDiv) resizeObserverErrDiv.style.display = 'none';
    if (resizeObserverErr) resizeObserverErr.style.display = 'none';
    e.stopImmediatePropagation();
    return;
  }
};
window.addEventListener('error', resizeObserverError);

// Suppress ResizeObserver errors from console
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('ResizeObserver') || 
      (typeof args[0] === 'string' && args[0].includes('ResizeObserver'))) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
