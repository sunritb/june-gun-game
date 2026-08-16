# Security Policy

## Reporting a Vulnerability

This is a **client-side technical prototype** — it ships no server or backend
components and handles no user data. Still, if you believe you have found a
security issue, **do not open a public issue**. Instead report it privately via
GitHub's Security Advisories (the **"Report a vulnerability"** button on this
repository).

Please include:

- A description of the issue and its potential impact
- Steps to reproduce (if applicable)
- The affected commit / version

You should receive a response within **72 hours**. Public disclosure is
coordinated after a fix is available.

## Scope

**In scope:** `index.html`, everything under `src/`, and the built
`bundle/game.js`.

**Out of scope:** `node_modules/` and `vendor/` (third-party libraries — report
those upstream). Report **game-balance** or **gameplay** issues through normal
issues, not this channel.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | ✅        |
