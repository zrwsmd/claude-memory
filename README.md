# Claude Memory Viewer Plugin

🧠 View and search your Claude Code conversation history through a beautiful local web interface.

## Quick Installation

### Option 1: Install via Plugin Command (Recommended)

```bash
# In Claude Code, run:
/plugin marketplace add zrwsmd/claude-memory
/plugin install claude-memory-viewer@claude-memory
```

### Option 2: Direct GitHub Installation

```bash
# In Claude Code:
/plugin marketplace add https://github.com/zrwsmd/claude-memory
/plugin install claude-memory-viewer@claude-memory
```

### Option 3: Manual Installation

```bash
# Clone to your skills directory
git clone https://github.com/zrwsmd/claude-memory ~/.claude/skills/claude-memory-viewer
cd ~/.claude/skills/claude-memory-viewer/skills/claude-memory-viewer
npm install
npm run build
```

## Usage

Once installed, simply ask Claude:

- **"Show me my Claude Code conversation history"**
- **"Search my conversations for 'React hooks'"**
- **"Open the conversation viewer"**

Claude will automatically start the web server at http://localhost:30010

## Features

✨ **Real-time Search** - Find conversations instantly with keyword highlighting  
📁 **Project Organization** - Filter conversations by project  
🔄 **Live Updates** - Auto-refreshes when new conversations are created  
💬 **Full History** - View complete message history with syntax highlighting  
🎯 **Smart Snippets** - See context around your search matches  
⚡ **Fast & Local** - No data leaves your machine

## Manual Commands

You can also start the viewer manually:

```bash
# Default settings
npm start

# Custom port
npm start -- --port 3000

# Custom Claude directory
npm start -- --claude-path /path/to/.claude/projects

# Don't auto-open browser
npm start -- --no-open
```

## Requirements

- Node.js 14+ and npm 6+
- Claude Code installed
- Conversation history in `~/.claude/projects/`

## Troubleshooting

**Port already in use?**
```bash
npm start -- --port 3001
```

**Conversations not showing?**
- Verify `~/.claude/projects/` exists
- Check that `.jsonl` files are present
- Try restarting the server

**Search is slow?**
- Search is debounced by 300ms to prevent lag
- Large conversation histories may take a moment to index

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev
```

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## License

MIT

---

Made with ❤️ for the Claude Code community