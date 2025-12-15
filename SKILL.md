---
name: claude-memory-viewer
description: View and search Claude Code conversation history through a local web interface. Use when the user wants to browse past conversations, search for specific topics, or review Claude Code interaction history.
---

# Claude Memory Viewer

A local web-based viewer for Claude Code conversation history with real-time search capabilities.

## What This Skill Does

This skill helps you access and search through your Claude Code conversation history by:
- Starting a local web server that displays all conversations
- Providing real-time search across all messages
- Organizing conversations by project
- Auto-refreshing when new conversations are created
- Highlighting search results in context

## When to Use This Skill

Use this skill when the user wants to:
- Browse their Claude Code conversation history
- Search for specific topics or keywords across past conversations
- Review previous interactions with Claude Code
- Find when they discussed a particular topic
- Access conversation history from specific projects

## How It Works

1. The skill starts a local web server on port 30010
2. Opens the viewer in your default browser
3. Reads conversations from `~/.claude/projects/`
4. Provides a search interface to find specific content
5. Updates automatically when new conversations are created

## Instructions for Claude

When the user asks to view their conversation history or search past interactions:

1. **Check if dependencies are installed:**
   ```bash
   cd {skill_directory}
   npm install
   ```

2. **Build the project (first time only):**
   ```bash
   npm run build
   ```

3. **Start the viewer:**
   ```bash
   npm start
   ```

4. **Inform the user:**
   - The viewer is now running at http://localhost:30010
   - They can search conversations using the search box
   - Filter by project using the dropdown
   - Click any conversation to view full details
   - Press Ctrl+C in the terminal to stop the server

## Usage Examples

**Example 1: Basic viewing**
- User: "Show me my Claude Code conversation history"
- Claude: *Starts the server and opens browser*
- Response: "I've started the Claude Memory viewer at http://localhost:30010. You can now browse all your conversations, search by keyword, and filter by project."

**Example 2: Searching**
- User: "Find all conversations where I discussed Python decorators"
- Claude: *Starts server if not running*
- Response: "The viewer is now open. Use the search box at the top to search for 'Python decorators' and it will show all matching conversations with highlighted results."

**Example 3: Project-specific**
- User: "What did I work on in my web-app project?"
- Claude: *Starts server*
- Response: "The viewer is ready. Select 'web-app' from the project dropdown to see all conversations from that project."

## Configuration Options

You can customize the server by passing options:

```bash
# Use custom port
npm start -- --port 3000

# Use custom Claude directory
npm start -- --claude-path /path/to/.claude/projects

# Start without auto-opening browser
npm start -- --no-open
```

## Troubleshooting

**If the server won't start:**
- Check if port 30010 is already in use
- Try a different port: `npm start -- --port 3001`
- Ensure `~/.claude/projects/` exists and has conversations

**If conversations don't appear:**
- Verify the Claude directory path is correct
- Check that `.jsonl` files exist in project folders
- Try restarting the server

**If search is slow:**
- The search is debounced by 300ms to prevent lag
- Large conversation histories may take a moment to index

## Technical Details

- **Language:** TypeScript/Node.js
- **Frontend:** React (vanilla, no build step)
- **Server:** Express with WebSocket support
- **Storage:** Reads directly from Claude Code's local `.jsonl` files
- **Port:** Default 30010 (configurable)

## Notes

- This is a local-only tool; no data is sent externally
- The viewer has read-only access to conversation files
- Changes to conversations update automatically via WebSocket
- Search is case-insensitive and highlights matches in context