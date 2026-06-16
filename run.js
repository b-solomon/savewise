// SaveWise Launcher — Starts both server and client
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log(`
╔══════════════════════════════════════════════════╗
║        🔐 SaveWise — Smart Finance Tracker       ║
║   Bank-Grade Encrypted • SMS Parser • Live P&L   ║
╚══════════════════════════════════════════════════╝
`);

function startProcess(name, cwd, cmd, args, color) {
  const p = spawn(cmd, args, { cwd, shell: true, stdio: 'pipe',
    env: { ...process.env, PATH: path.join(__dirname, 'node_env') + ';' + process.env.PATH, FORCE_COLOR: '1' }
  });
  p.stdout.on('data', d => d.toString().trim().split('\n').forEach(l => console.log(`${color}[${name}]\x1b[0m ${l}`)));
  p.stderr.on('data', d => d.toString().trim().split('\n').forEach(l => console.log(`${color}[${name}]\x1b[0m ${l}`)));
  p.on('exit', code => console.log(`\x1b[33m[${name}] Exited (${code})\x1b[0m`));
  return p;
}

const server = startProcess('Server', path.join(__dirname, 'savewise', 'server'), 'node', ['server.js'], '\x1b[32m');
setTimeout(() => {
  const client = startProcess('Client', path.join(__dirname, 'savewise', 'client'), 'npx', ['vite', '--port', '3001'], '\x1b[36m');
  setTimeout(() => console.log('\n\x1b[32m✅ Open: http://localhost:3001\x1b[0m\n'), 3000);
}, 2000);

process.on('SIGINT', () => process.exit(0));
