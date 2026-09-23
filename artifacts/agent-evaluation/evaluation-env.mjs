import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const skillDir=process.env.SYSTEM_BLUEPRINT_SKILL_DIR || fileURLToPath(new URL('../system-blueprint/',import.meta.url));
export const {chromium}=await import(pathToFileURL(path.join(skillDir,'node_modules/playwright/index.mjs')).href);
