import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (!existsSync('.git')) {
  console.log('Skipping Lefthook installation outside a Git checkout.');
  process.exit(0);
}

const command = resolve('node_modules', '.bin', process.platform === 'win32' ? 'lefthook.cmd' : 'lefthook');
const result = spawnSync(command, ['install'], { stdio: 'inherit', shell: process.platform === 'win32' });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
