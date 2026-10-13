import { clipboard } from 'electron';
import { spawn } from 'child_process';

export async function deliverText(text: string): Promise<void> {
  if (!text) return;
  clipboard.writeText(text);
  await sleep(60);
  await simulatePaste();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function simulatePaste(): Promise<void> {
  if (process.platform === 'darwin') return pasteMac();
  if (process.platform === 'win32') return pasteWin();
  return Promise.resolve();
}

function pasteMac(): Promise<void> {
  return run('osascript', [
    '-e',
    'tell application "System Events" to keystroke "v" using command down',
  ]);
}

function pasteWin(): Promise<void> {
  const script = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')";
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Keep stderr: a denied Accessibility permission surfaces only as
    // osascript's message ("not allowed to send keystrokes"), and discarding
    // it left a failed paste indistinguishable from any other non-zero exit.
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-500);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${stderr.trim()}`));
    });
  });
}
