#!/usr/bin/env python3
"""
Python wrapper to start Claude Memory viewer.
This makes it easier for Claude to invoke the skill.
"""

import subprocess
import sys
import os
from pathlib import Path

def start_viewer(port=30010, claude_path=None, no_open=False):
    """Start the Claude Memory viewer server."""
    
    # Get the directory where this script is located
    skill_dir = Path(__file__).parent.parent
    
    # Check if node_modules exists, install if not
    if not (skill_dir / "node_modules").exists():
        print("📦 Installing dependencies...")
        subprocess.run(["npm", "install"], cwd=skill_dir, check=True)
    
    # Check if dist exists, build if not
    if not (skill_dir / "dist").exists():
        print("🔨 Building project...")
        subprocess.run(["npm", "run", "build"], cwd=skill_dir, check=True)
    
    # Build command
    cmd = ["npm", "start", "--"]
    cmd.extend(["--port", str(port)])
    
    if claude_path:
        cmd.extend(["--claude-path", claude_path])
    
    if no_open:
        cmd.append("--no-open")
    
    print(f"🧠 Starting Claude Memory viewer on port {port}...")
    print(f"📂 Reading from: {claude_path or '~/.claude/projects'}")
    print(f"🌐 Open http://localhost:{port} in your browser")
    print("Press Ctrl+C to stop the server\n")
    
    # Start the server
    try:
        subprocess.run(cmd, cwd=skill_dir)
    except KeyboardInterrupt:
        print("\n👋 Stopping Claude Memory viewer...")
        sys.exit(0)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Start Claude Memory viewer")
    parser.add_argument("--port", type=int, default=30010, help="Port to run server on")
    parser.add_argument("--claude-path", help="Path to Claude projects directory")
    parser.add_argument("--no-open", action="store_true", help="Don't open browser")
    
    args = parser.parse_args()
    
    start_viewer(
        port=args.port,
        claude_path=args.claude_path,
        no_open=args.no_open
    )