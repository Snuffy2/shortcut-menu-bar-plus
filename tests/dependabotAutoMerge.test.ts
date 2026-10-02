import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const baseSha = '1'.repeat(40);
const headSha = '2'.repeat(40);
const repository = 'Snuffy2/shortcut-menu-bar-plus';
const helperUrl = pathToFileURL(resolve('.github/scripts/dependabot-auto-merge.mjs')).href;

const defaultInput = {
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
    return structuredClone(defaultInput);
}

function authorize(input: ReturnType<typeof inputs>): ReturnType<typeof spawnSync> {
    // Run the unchanged ESM helper in Node rather than transforming it through Jest.
    return spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { authorizeDependabotUpdate } from ${JSON.stringify(helperUrl)};
        console.log(authorizeDependabotUpdate(JSON.parse(process.argv[1])));
    `, JSON.stringify(input)], { encoding: 'utf8' });
}

describe('Dependabot auto-merge authorization', () => {
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
        input.changedFiles = ['.github/workflows/publish-vscode-marketplace.yml'];
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
});
