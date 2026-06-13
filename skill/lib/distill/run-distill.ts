import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFeedback } from '../feedback-log.js';
import { renderTasteOverrides } from './render-taste-overrides.ts';

interface StatusPayload {
    ok: boolean;
    last_run_iso: string;
    records_in?: number;
    records_out?: number;
    drift?: number;
    error?: string;
}

function vaultPath(): string {
    return process.env.DESIGN_LAB_VAULT_PATH ?? join(homedir(), 'Documents/CC Cli/design-library');
}

function statusPath(): string {
    const stateDir = process.env.DESIGN_LAB_STATE_PATH ?? join(homedir(), '.claude/state/design-lab');
    return join(stateDir, 'distill-status.json');
}

function writeStatus(payload: StatusPayload): void {
    const target = statusPath();
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
}

function countFeedbackLines(vault: string): number {
    const logPath = join(vault, 'feedback-log.jsonl');
    if (!existsSync(logPath)) {
        return 0;
    }
    return readFileSync(logPath, 'utf8')
        .split('\n')
        .filter((line) => line.trim())
        .length;
}

function readProcessedRecords(markdown: string): number {
    const match = markdown.match(/^processed_records:\s*(\d+)$/m);
    if (!match) {
        throw new Error('taste-overrides.md missing processed_records');
    }
    return Number.parseInt(match[1], 10);
}

function notifyFailure(message: string): void {
    try {
        execFileSync('osascript', [
            '-e',
            `display notification "${message.replaceAll('"', '\\"')}" with title "design-lab distill failed"`
        ], { stdio: 'ignore' });
    } catch {
        // Notification is best-effort; the distill error remains the source of truth.
    }
}

function writeTasteOverrides(vault: string, markdown: string): void {
    const target = join(vault, 'taste-overrides.md');
    const temp = join(vault, `.taste-overrides.${process.pid}.${Date.now()}.tmp`);
    try {
        writeFileSync(temp, markdown);
        renameSync(temp, target);
    } catch (error) {
        rmSync(temp, { force: true });
        throw error;
    }
}

export function runDistill(): StatusPayload {
    const vault = vaultPath();
    const recordsIn = countFeedbackLines(vault);
    const feedback = readFeedback(vault);
    const rendered = renderTasteOverrides(feedback);
    writeTasteOverrides(vault, rendered.markdown);

    const written = readFileSync(join(vault, 'taste-overrides.md'), 'utf8');
    const recordsOut = readProcessedRecords(written);
    const drift = recordsOut - recordsIn;
    if (drift !== 0) {
        throw new Error(`processed_records drift: feedback-log has ${recordsIn}, taste-overrides has ${recordsOut}`);
    }

    return {
        ok: true,
        last_run_iso: new Date().toISOString(),
        records_in: recordsIn,
        records_out: recordsOut,
        drift
    };
}

function runCli(): void {
    try {
        const status = runDistill();
        writeStatus(status);
        process.stdout.write(`design-lab distill ok: records=${status.records_in} drift=${status.drift}\n`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failedStatus: StatusPayload = {
            ok: false,
            last_run_iso: new Date().toISOString(),
            error: message
        };
        try {
            writeStatus(failedStatus);
        } catch (statusError) {
            const statusMessage = statusError instanceof Error ? statusError.message : String(statusError);
            process.stderr.write(`ERROR: design-lab distill failed and status write failed: ${message}; status_error=${statusMessage}\n`);
            notifyFailure(message);
            process.exit(1);
        }
        process.stderr.write(`ERROR: design-lab distill failed: ${message}\n`);
        notifyFailure(message);
        process.exit(1);
    }
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
    runCli();
}
