import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const apiRoot = path.resolve(__dirname, '../../');

  // Higher precedence files are loaded first because dotenv does not override by default.
  const envFiles = [
    `.env.${nodeEnv}.local`,
    '.env.local',
    `.env.${nodeEnv}`,
    '.env',
  ];

  for (const file of envFiles) {
    const fullPath = path.join(apiRoot, file);
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath });
    }
  }
}

