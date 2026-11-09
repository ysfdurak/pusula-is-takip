// Elle yedek: npm run backup   (DATA_DIR ve BACKUP_DIR ayarlarını kullanır)
import { loadConfig } from './config.js';
import { openStore } from './store.js';
const config = loadConfig({ ...process.env, AUTH_MODE: 'dev', NODE_ENV: '' });
const store = openStore(config.dbFile);
console.log('Yedek:', store.backup(config.backupDir, config.backupKeep));
store.close();
