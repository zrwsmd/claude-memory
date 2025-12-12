# Claude Memory

Claude Code conversation history viewer with real-time updates.

## Installation
```bash
npm install
npm run build
npm link
```

## Usage
```bash
# Start viewer (reads from ~/.claude/projects by default)
claude-memory start

# Use custom Claude path
claude-memory start --claude-path /path/to/.claude/projects
```

## Features
- 📚 View all Claude Code conversation history
- 🔍 Real-time search across conversations
- 🔄 Auto-refresh when new conversations are created
- 💬 Full message history display
- 📁 Project organization

The viewer reads directly from Claude Code's local storage at `~/.claude/projects/`.
