#!/usr/bin/env node
import { Command } from "commander";
import { MemoryServer } from "./server";
import path from "path";
import os from "os";
import open from "open";

const program = new Command();
program
  .name("claude-memory")
  .version("1.0.0")
  .description("Claude Code conversation history viewer");

program
  .command("start")
  .option("-p, --port <port>", "Port", "30010")
  .option("-h, --host <host>", "Host", "localhost")
  .option("--claude-path <path>", "Path to .claude directory")
  .option("--no-open", "No browser")
  .action(async (opts) => {
    const claudePath =
      opts.claudePath || path.join(os.homedir(), ".claude", "projects");
    const srv = new MemoryServer({
      port: parseInt(opts.port),
      host: opts.host,
      claudePath,
    });
    const port = await srv.start();
    opts.open && (await open(`http://${opts.host}:${port}`));
    process.on("SIGINT", () => {
      srv.stop();
      process.exit(0);
    });
  });

program.parse();
