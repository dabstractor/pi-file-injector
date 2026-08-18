# File & URL Content Injection — Specification

**Status:** Draft · **Target:** Pi pi-coding-agent (verified against v0.80.7) · **Artifact type:** Pi TypeScript extension

A Pi extension that injects whole local files and fetched web pages into the model's context
at prompt-submit time. This specification is split into atomic files under spec/. Each part is
linked below by its relative @path — reference this file to import the whole spec transitively,
or reference any single part to import just that section.

## Index

@01-overview.md  Overview
@02-goals.md  Goals & Non-Goals
@03-background.md  Background: how Pi handles input
@04-syntax.md  Syntax specification
@05-file-behavior.md  Behavior by file type
@06-delivery-display.md  Output format, delivery & display
@07-technical-reference.md  Technical reference (verified APIs)
@08-file-structure.md  File structure
@09-algorithm.md  Algorithm (pseudocode)
@10-edge-cases.md  Edge cases
@11-acceptance-tests.md  Acceptance criteria & test plan
@12-implementation-notes.md  Implementation notes & gotchas
@13-design-rationale.md  Design rationale & tradeoffs
@14-autocomplete.md  Interactive path autocomplete
@15-url-injection.md  Feature: URL web-content injection
@16-appendix-skeleton.md  Appendix A: minimal skeleton
@17-line-ranges.md  Feature: `#@path:N` / `:N-M` line ranges