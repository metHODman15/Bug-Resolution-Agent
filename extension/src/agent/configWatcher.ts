/**
 * Config Watcher — monitors .github/AGENTS.md and .github/copilot-instructions.md
 * for changes and reloads agent configuration at runtime.
 *
 * Emits a VS Code event whenever the merged config changes so that
 * the extension can react (e.g. update the webview agent selector).
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    MergedAgentConfig,
    mergeConfigs,
} from './markdownParser';

const AGENTS_PATH = '.github/AGENTS.md';
const INSTRUCTIONS_PATH = '.github/copilot-instructions.md';

export class ConfigWatcher implements vscode.Disposable {
    private readonly emitter = new vscode.EventEmitter<MergedAgentConfig>();
    readonly onConfigChanged: vscode.Event<MergedAgentConfig> = this.emitter.event;

    private watchers: vscode.FileSystemWatcher[] = [];
    private current: MergedAgentConfig | undefined;

    constructor() {
        this.setupWatchers();
    }

    /** Read + parse current config from workspace. */
    load(): MergedAgentConfig {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsRoot) {
            return mergeConfigs(null, null);
        }
        const agentsContent = this.readFile(path.join(wsRoot, AGENTS_PATH));
        const instructionsContent = this.readFile(path.join(wsRoot, INSTRUCTIONS_PATH));
        this.current = mergeConfigs(agentsContent, instructionsContent);
        return this.current;
    }

    /** Get last-loaded config (or load fresh). */
    getConfig(): MergedAgentConfig {
        return this.current ?? this.load();
    }

    /** Check whether required markdown files exist. */
    filesExist(): { agentsExists: boolean; instructionsExists: boolean } {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsRoot) {
            return { agentsExists: false, instructionsExists: false };
        }
        return {
            agentsExists: fs.existsSync(path.join(wsRoot, AGENTS_PATH)),
            instructionsExists: fs.existsSync(path.join(wsRoot, INSTRUCTIONS_PATH)),
        };
    }

    /** Generate default template files if they do not exist. */
    async generateTemplates(): Promise<boolean> {
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!wsRoot) { return false; }

        const githubDir = path.join(wsRoot, '.github');
        if (!fs.existsSync(githubDir)) {
            fs.mkdirSync(githubDir, { recursive: true });
        }

        let created = false;
        const agentsPath = path.join(wsRoot, AGENTS_PATH);
        if (!fs.existsSync(agentsPath)) {
            fs.writeFileSync(agentsPath, DEFAULT_AGENTS_TEMPLATE, 'utf8');
            created = true;
        }

        const instructionsPath = path.join(wsRoot, INSTRUCTIONS_PATH);
        if (!fs.existsSync(instructionsPath)) {
            fs.writeFileSync(instructionsPath, DEFAULT_INSTRUCTIONS_TEMPLATE, 'utf8');
            created = true;
        }

        if (created) {
            this.load();
            this.emitter.fire(this.current!);
        }
        return created;
    }

    dispose(): void {
        for (const w of this.watchers) { w.dispose(); }
        this.emitter.dispose();
    }

    /* ── private ─────────────────────────────────────────────────────────────── */

    private setupWatchers(): void {
        const agentsPattern = new vscode.RelativePattern(
            vscode.workspace.workspaceFolders?.[0] ?? '',
            AGENTS_PATH,
        );
        const instructionsPattern = new vscode.RelativePattern(
            vscode.workspace.workspaceFolders?.[0] ?? '',
            INSTRUCTIONS_PATH,
        );

        const reload = () => {
            this.load();
            if (this.current) {
                this.emitter.fire(this.current);
            }
        };

        for (const pattern of [agentsPattern, instructionsPattern]) {
            const w = vscode.workspace.createFileSystemWatcher(pattern);
            w.onDidChange(reload);
            w.onDidCreate(reload);
            w.onDidDelete(reload);
            this.watchers.push(w);
        }
    }

    private readFile(filePath: string): string | null {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch {
            return null;
        }
    }
}

/* ── Default templates ─────────────────────────────────────────────────────── */

const DEFAULT_AGENTS_TEMPLATE = `---
schema_version: "1.0"
---

# AGENTS.md

## Agents

### Build Agent

Role:
Primary code-generation and workspace management agent.

Description:
Assists with building, editing, and managing code in the workspace.

Tools:
- File read/write
- Workspace search
- Git diff/status
- Diagnostics

Terminal: allowed

## Execution Order
- Build Agent

## Autonomy Boundaries
- No production changes
- No silent failure
- Require confirmation for destructive actions
`;

const DEFAULT_INSTRUCTIONS_TEMPLATE = `---
schema_version: "1.0"
---

# Copilot Instructions

## Purpose & Operating Contract

This document defines how the build agent behaves inside this repository.

## Autonomy Boundaries

- Never modify files outside the workspace
- Never push to main or develop without approval
- Never skip tests
- Always validate changes locally before committing

## Execution Environment

- Local-first development
- Workspace-scoped operations only
`;
