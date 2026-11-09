import './styles.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { PreviewSetup } from './components/PreviewSetup.jsx';
import { configurePreview, previewNeedsSetup } from './demo/demoServer.js';

// Derleme modları:
//   (varsayılan)   tasarım demosu: örnek verilerle, tarayıcı içi örnek sunucu
//   --mode preview pilot önizlemesi: örnek veri yok, boş başlar; veriler yalnızca bu tarayıcıda
//   --mode pilot   pilot sunucusu: /api/workspace, Microsoft girişi
const mode = import.meta.env.MODE;
const demo = mode !== 'pilot';
const preview = mode === 'preview';
if (preview) configurePreview();

function Root() {
  const [ready, setReady] = useState(!previewNeedsSetup());
  return ready ? <App demo={demo} preview={preview} /> : <PreviewSetup onReady={() => setReady(true)} />;
}

createRoot(document.getElementById('root')).render(<Root />);
