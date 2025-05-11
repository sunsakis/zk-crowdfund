import React from 'react';
import { createRoot } from 'react-dom/client';
import ZKCrowdfunding from './App';

// Polyfill Buffer for browser
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Create root element if it doesn't exist
let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

// Render the application
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ZKCrowdfunding />
  </React.StrictMode>
);