# Changelog

All notable changes to this project will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Tag format: `ts-v<semver>` for the npm package, `py-v<semver>` for the PyPI package.

---

## [Unreleased]

---

## [0.1.0] — 2026-03-16

### Added
- **Record/Replay** — Wrap Anthropic or OpenAI SDK clients; cassettes stored as YAML
- **Cassette modes** — `record`, `replay`, `passthrough`, `hybrid`
- **Metrics** — `ExactMatch`, `Contains`, `ContainsAll`, `Regex`, `JSONSchema`, `Similarity`, `LLMJudge`, `Custom`
- **Regression baseline** — `saveBaseline` / `compareBaseline` with configurable threshold
- **HTTP interceptor** — `harness.interceptFetch()` monkey-patches `globalThis.fetch` (TypeScript)
- **Cross-language cassette parity** — identical SHA-256 hash algorithm in TypeScript and Python; verified by shared `hash-vectors.json`
- **TypeScript package** (`llm-test-harness`) — ESM + CJS dual output, full `.d.ts` declarations
- **Python package** (`llm-test-harness`) — hatchling build, PEP 561 typed, Python ≥ 3.10
