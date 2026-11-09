import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceApp } from './pages/WorkspaceApp.jsx';
import './styles.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><WorkspaceApp /></React.StrictMode>);
