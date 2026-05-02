import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { dirname } from 'path';

const STATE_FILE = process.env.DESIGN_LAB_STATE_PATH
    ? `${process.env.DESIGN_LAB_STATE_PATH}/last-artifact.txt`
    : `${process.env.HOME}/.claude/state/design-lab/last-artifact.txt`;

export function writeLastArtifact(slug) {
    const dir = dirname(STATE_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // atomic: write to .tmp then rename
    const tmp = STATE_FILE + '.tmp';
    writeFileSync(tmp, slug);
    renameSync(tmp, STATE_FILE);
}

export function readLastArtifact() {
    if (!existsSync(STATE_FILE)) return null;
    return readFileSync(STATE_FILE, 'utf8').trim();
}
