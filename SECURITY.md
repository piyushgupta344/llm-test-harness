# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x (latest) | Yes |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report security issues by emailing the maintainer directly or using [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).

Include:
- A description of the vulnerability and its potential impact
- Steps to reproduce (proof of concept if possible)
- Affected versions

You can expect an acknowledgement within 72 hours and a fix or workaround within 14 days for confirmed issues.

## Scope

This library processes LLM API requests and caches responses locally. Key areas of concern:

- **Cassette files** — stored in user-controlled directories; not executed, only read/written as YAML. Use `onBeforeRecord` to scrub secrets before cassettes are written.
- **API keys** — never stored by this library; pass through to the underlying SDK only.
- **Dependencies** — pyyaml, jsonschema (Python); js-yaml, ajv (TypeScript). Keep these updated.
