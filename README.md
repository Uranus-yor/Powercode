<p align="center">
  <img src="logo.png" alt="PowerCode" width="200">
</p>

<h1 align="center">PowerCode</h1>

<p align="center">
  <strong>Terminal AI Coding Assistant</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#license">License</a>
</p>

---

## Overview

PowerCode is a powerful terminal-based AI coding assistant that brings the power of large language models directly to your terminal. With a beautiful TUI interface, multi-agent support, and seamless tool integration, it transforms how you write code.

## Features

### Beautiful Terminal Interface
- Modern TUI design with color-coded content bars
- Smooth cursor animation and real-time status display
- Responsive layout that adapts to terminal size
- Markdown rendering with syntax highlighting

### Multi-Agent Orchestration
- Run multiple AI agents in parallel
- Task decomposition and intelligent routing
- Real-time agent status dashboard
- Automatic result aggregation

### Powerful Tool Integration
- File read/write operations
- Shell command execution
- Web search and fetch
- MCP (Model Context Protocol) support

### Smart Context Management
- Automatic context compression
- Session persistence and resume
- Transcript history with search
- Intelligent token management

### Developer Experience
- Keyboard-first navigation
- Slash command system
- Command history
- Clipboard integration

## Quick Start

### Installation

```bash
npm install -g powercode
```

### Setup

```bash
# Run the installer
powercode --install

# Or configure manually
export ANTHROPIC_API_KEY="your-api-key"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
```

### Launch

```bash
# Start in current directory
power

# Start with a specific model
power --model claude-3-opus-20240229

# Resume a previous session
power --resume <session-id>
```

## Usage

### Basic Interaction

```
> Write a function to calculate fibonacci numbers
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/tools` | List available tools |
| `/sessions` | List saved sessions |
| `/resume` | Resume a previous session |
| `/new` | Start a new session |
| `/compact` | Compress context |
| `/multi` | Run multi-agent task |

### Multi-Agent Mode

```
> /multi Review all security vulnerabilities in src/ and create a fix plan
```

This will:
1. Decompose the task into subtasks
2. Run multiple agents in parallel
3. Aggregate results into a comprehensive report

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Esc` | Clear input |
| `Ctrl+C` | Exit |
| `↑/↓` | Navigate history |
| `Tab` | Switch focus |

## Configuration

### Settings File

Located at `~/.powercode/settings.json`:

```json
{
  "model": "claude-3-opus-20240229",
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_AUTH_TOKEN": "your-token"
  }
}
```

### MCP Servers

Configure MCP servers in `.powercode/mcp.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  ]
}
```

## Architecture

```
src/
├── tui/              # Terminal UI components
│   ├── chrome.ts     # UI panels and borders
│   ├── colors.ts     # Color system
│   ├── transcript.ts # Message rendering
│   ├── markdown.ts   # Markdown parser
│   └── logo.ts       # Input panel
├── core/             # Core agent loop
├── tools/            # Built-in tools
├── multi-agent/      # Multi-agent orchestration
├── compact/          # Context compression
└── index.ts          # Entry point
```

## Development

```bash
# Clone the repository
git clone https://github.com/Uranus-yor/Powercode.git
cd Powercode

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Type check
npm run check

# Lint
npm run lint
```

## License

MIT License - see [LICENSE](LICENSE) for details

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Uranus-yor">Uranus-yor</a>
</p>
