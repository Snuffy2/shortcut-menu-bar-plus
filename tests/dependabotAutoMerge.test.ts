import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const baseSha = '1'.repeat(40);
const headSha = '2'.repeat(40);
const olderBaseSha = '4'.repeat(40);
const repository = 'Snuffy2/shortcut-menu-bar-plus';
const helperPath = resolve('.github/scripts/dependabot-auto-merge.mjs');
const helperUrl = pathToFileURL(helperPath).href;

let trustedBaseDirectory: string;

const defaultInput = {
    trustedBaseDirectory: '',
    event: {
        repository: { default_branch: 'main', fork: false, full_name: repository },
        pull_request: {
            user: { login: 'dependabot[bot]' },
            base: { ref: 'main', sha: baseSha },
            head: { ref: 'dependabot/npm_and_yarn/development-dependencies', sha: headSha, repo: { full_name: repository } },
        },
    },
    changedFiles: ['package-lock.json'],
    commits: [{
        sha: headSha,
        author: { login: 'dependabot[bot]' },
        committer: { login: 'web-flow' },
        commit: { verification: { verified: true } },
        parents: [] as { sha: string }[],
    }],
    ancestryProofs: [] as object[],
};

function inputs(): typeof defaultInput {
    return { ...structuredClone(defaultInput), trustedBaseDirectory };
}

function authorize(input: ReturnType<typeof inputs>): ReturnType<typeof spawnSync> {
    // Run the unchanged ESM helper in Node rather than transforming it through Jest.
    return spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { authorizeDependabotUpdate } from ${JSON.stringify(helperUrl)};
        console.log(authorizeDependabotUpdate(JSON.parse(process.argv[1])));
    `, JSON.stringify(input)], { encoding: 'utf8' });
}

function authorizeFromFiles(input: ReturnType<typeof inputs>): ReturnType<typeof spawnSync> {
    const fixtureDirectory = mkdtempSync(join(tmpdir(), 'dependabot-auto-merge-'));
    try {
        const eventPath = join(fixtureDirectory, 'event.json');
        const changedFilesPath = join(fixtureDirectory, 'changed-files.txt');
        const commitsPath = join(fixtureDirectory, 'commits.json');
        const ancestryProofsPath = join(fixtureDirectory, 'ancestry-proofs.json');
        writeFileSync(eventPath, JSON.stringify(input.event));
        writeFileSync(changedFilesPath, input.changedFiles.join('\n'));
        writeFileSync(commitsPath, JSON.stringify([input.commits.slice(0, 1), input.commits.slice(1)]));
        writeFileSync(ancestryProofsPath, JSON.stringify(input.ancestryProofs));
        return spawnSync(process.execPath, [helperPath, eventPath, changedFilesPath, commitsPath, ancestryProofsPath], { encoding: 'utf8', cwd: trustedBaseDirectory });
    } finally {
        rmSync(fixtureDirectory, { recursive: true, force: true });
    }
}

function updateBranchInputs(): ReturnType<typeof inputs> {
    const input = inputs();
    const mergeSha = '3'.repeat(40);
    input.event.pull_request.head.sha = mergeSha;
    input.commits.push({
        ...input.commits[0],
        sha: mergeSha,
        author: { login: 'maintainer' },
        parents: [{ sha: headSha }, { sha: olderBaseSha }],
    });
    input.ancestryProofs = [{
        parent_sha: olderBaseSha,
        base_sha: baseSha,
        base_commit: olderBaseSha,
        head_commit: baseSha,
        merge_base_commit: olderBaseSha,
        status: 'ahead',
        ahead_by: 3,
        behind_by: 0,
    }];
    return input;
}

describe('Dependabot auto-merge authorization', () => {
    beforeEach(() => {
        trustedBaseDirectory = mkdtempSync(join(tmpdir(), 'dependabot-trusted-base-'));
        writeFileSync(join(trustedBaseDirectory, 'package.json'), '{}');
        writeFileSync(join(trustedBaseDirectory, 'package-lock.json'), '{}');
        mkdirSync(join(trustedBaseDirectory, '.github', 'workflows'), { recursive: true });
        writeFileSync(join(trustedBaseDirectory, '.github', 'workflows', 'fixture.yml'), 'name: Fixture\n');
    });

    afterEach(() => {
        rmSync(trustedBaseDirectory, { recursive: true, force: true });
    });

    it.each([
        ['package-lock.json'],
        ['package.json', 'package-lock.json'],
    ])('allows npm update files %j', (...changedFiles: string[]) => {
        const input = inputs();
        input.changedFiles = changedFiles;
        const result = authorize(input);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('npm\n');
    });

    it('allows an existing GitHub Actions workflow update', () => {
        const input = inputs();
        input.event.pull_request.head.ref = 'dependabot/github_actions/actions/checkout-7';
        input.changedFiles = ['.github/workflows/fixture.yml'];
        const result = authorize(input);
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('github-actions\n');
    });

    it.each(['manifest-only', 'extra-file', 'fork', 'human-author', 'unverified', 'stale-head', 'wrong-base', 'new-workflow'])('rejects %s updates', (scenario: string) => {
        const input = inputs();
        if (scenario === 'manifest-only') input.changedFiles = ['package.json'];
        if (scenario === 'extra-file') input.changedFiles.push('src/extension.ts');
        if (scenario === 'fork') input.event.pull_request.head.repo.full_name = 'other/fork';
        if (scenario === 'human-author') input.commits[0].author.login = 'maintainer';
        if (scenario === 'unverified') input.commits[0].commit.verification.verified = false;
        if (scenario === 'stale-head') input.event.pull_request.head.sha = baseSha;
        if (scenario === 'wrong-base') input.event.pull_request.base.ref = 'release';
        if (scenario === 'new-workflow') {
            input.event.pull_request.head.ref = 'dependabot/github_actions/new-action';
            input.changedFiles = ['.github/workflows/nonexistent.yml'];
        }
        const result = authorize(input);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('Refusing auto-merge');
    });

    it.each([true, false])('requires ancestry proof for a GitHub Update branch merge (proof: %s)', (withProof: boolean) => {
        const input = inputs();
        const mergeSha = '3'.repeat(40);
        input.event.pull_request.head.sha = mergeSha;
        input.commits.push({
            ...input.commits[0],
            sha: mergeSha,
            author: { login: 'maintainer' },
            parents: [{ sha: headSha }, { sha: baseSha }],
        });
        if (withProof) input.ancestryProofs = [{
            parent_sha: baseSha, base_sha: baseSha, base_commit: baseSha,
            head_commit: baseSha, merge_base_commit: baseSha,
            status: 'identical', ahead_by: 0, behind_by: 0,
        }];
        const result = authorize(input);
        expect(result.status === 0).toBe(withProof);
        if (!withProof) expect(result.stderr).toContain('Refusing auto-merge');
    });

    it('runs the file-based CLI for paginated commits with an older base parent', () => {
        const result = authorizeFromFiles(updateBranchInputs());
        expect(result.status).toBe(0);
    });

    it('rejects file-based CLI input when the merge parent is outside current base ancestry', () => {
        const input = updateBranchInputs();
        input.ancestryProofs[0] = {
            ...input.ancestryProofs[0],
            status: 'behind',
            ahead_by: 0,
            behind_by: 3,
        };
        const result = authorizeFromFiles(input);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('a merge second parent is not proven to be on the current base');
    });
});
