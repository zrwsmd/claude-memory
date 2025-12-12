# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build the project**: `npm run build`
  - This compiles the TypeScript source code in `src/` into JavaScript in `dist/`.
- **Run in development**: `npm run dev`
  - This starts the application using `ts-node`, allowing for live changes without manual recompilation.
- **Run the compiled application**: `npm start`
  - This executes the built JavaScript version of the CLI.
- **Install and link for local use**:
  ```bash
  npm install
  npm run build
  npm link
  ```

## Architecture

This project, "Claude Memory," is a tool for viewing Claude Code conversation history. It operates as a local web application launched from the command line.

- **`src/cli.ts`**: The entry point for the command-line interface. It uses the `commander` library to parse arguments, such as a custom path to the Claude Code data directory.
- **`src/reader.ts`**: This module is responsible for accessing the file system. It locates and reads the conversation history files stored by Claude Code, typically located in `~/.claude/projects/`. It also watches for file system changes to enable real-time updates.
- **`src/server.ts`**: This file sets up and manages an Express web server. It serves a static frontend located in the `public/` directory and establishes a WebSocket (`ws`) connection to push conversation data and updates to the client in real-time.
- **`public/`**: This directory contains the frontend assets (HTML, CSS, JavaScript) that constitute the user interface for the conversation viewer.
