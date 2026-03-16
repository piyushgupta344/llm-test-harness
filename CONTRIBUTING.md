# Contributing

## Setup

### TypeScript

```bash
# From repo root
pnpm install

cd packages/llm-test-harness
pnpm typecheck   # must be clean
pnpm test        # 132+ tests
pnpm build       # produces dist/
```

### Python

```bash
cd packages/llm-test-harness-python
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/ -v        # 67+ tests
mypy llm_test_harness/  # strict, no errors
```

## Cross-language cassette parity

The SHA-256 hash algorithm **must produce identical output in both TS and Python** for the same logical request. Any change to `cassette-hash.ts` or `cassette/hash.py` must:

1. Update `tests/fixtures/hash-vectors.json` with the new expected hashes
2. Verify both test suites pass against the updated vectors

Run the TS side to recompute vectors:
```bash
cd packages/llm-test-harness
pnpm build
node --input-type=module <<'EOF'
import { hashRequest } from './dist/index.js'
// … print new hashes
EOF
```

## Pull requests

- Keep PRs focused on one change
- Add or update tests for every behaviour change
- Update `CHANGELOG.md` under `[Unreleased]`
- Breaking changes require a major version bump discussion in the PR

## Releasing

See the Release section in the README. Tag format: `ts-v<semver>` for npm, `py-v<semver>` for PyPI.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
