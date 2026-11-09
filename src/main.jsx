import './styles.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';

// Tasarım demosu tarayıcı içi örnek sunucuyla çalışır; pilot derlemesi (vite --mode pilot) /api/workspace ile konuşur.
const demo = import.meta.env.MODE !== 'pilot';

createRoot(document.getElementById('root')).render(<App demo={demo} />);
