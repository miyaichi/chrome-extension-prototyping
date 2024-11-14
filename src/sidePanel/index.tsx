// src/sidePanel/index.tsx
import { createRoot } from 'react-dom/client';
import SidePanel from './SidePanel';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<SidePanel />);