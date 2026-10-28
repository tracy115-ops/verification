import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import '@xyflow/react/dist/style.css';
import './styles/workbench-tokens.css';
import './styles/workbench-foundation.css';
import './styles/global.css';
import './styles/workflows-ui.css';
import './styles/settings-ui.css';
import './styles/reviews-ui.css';
import './styles/runs-ui.css';
import './styles/sessions-ui.css';
import './styles/artifacts-ui.css';
import './styles/transcript-ui.css';
import './styles/team-ui.css';
import './styles/lan-ui.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
