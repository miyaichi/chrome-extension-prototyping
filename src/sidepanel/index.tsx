// src/sidepanel/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import SidePanel from './SidePanel';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
);