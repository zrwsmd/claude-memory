import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { ClaudeHistoryReader } from "./reader";
import { ServerConfig } from "./types";
import path from "path";
import chokidar from "chokidar";

export class MemoryServer {
  private app = express();
  private reader: ClaudeHistoryReader;
  private wss?: WebSocketServer;
  private watcher?: chokidar.FSWatcher;

  constructor(private config: ServerConfig) {
    this.reader = new ClaudeHistoryReader(config.claudePath);
    this.app.use(cors());
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use(express.static(path.join(__dirname, "../public")));
    this.setupRoutes();
    this.setupFileWatcher();
  }

  private setupFileWatcher() {
    // Watch Claude directory for changes
    this.watcher = chokidar.watch(this.config.claudePath, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on("change", () => {
      this.broadcast({ type: "conversations_updated" });
    });
  }

  private setupRoutes() {
    this.app.get("/api/health", (_, res) =>
      res.json({ status: "ok", claudePath: this.config.claudePath })
    );

    this.app.get("/api/projects", (_, res) => {
      try {
        const projects = this.reader.getAllProjects();
        res.json(projects);
      } catch (error) {
        res.status(500).json({ error: "Failed to load projects" });
      }
    });

    this.app.get("/api/conversations", (_, res) => {
      try {
        const conversations = this.reader.getAllConversations();
        res.json(conversations);
      } catch (error) {
        console.error("Error loading conversations:", error);
        res.status(500).json({ error: "Failed to load conversations" });
      }
    });

    this.app.get("/api/conversations/:projectPath", (req, res) => {
      try {
        const conversations = this.reader.getConversationsByProject(
          req.params.projectPath
        );
        res.json(conversations);
      } catch (error) {
        res.status(500).json({ error: "Failed to load conversations" });
      }
    });

    this.app.get("/api/conversations/:projectPath/:id", (req, res) => {
      try {
        const conv = this.reader.getConversation(
          req.params.projectPath,
          req.params.id
        );
        conv ? res.json(conv) : res.status(404).json({ error: "Not found" });
      } catch (error) {
        res.status(500).json({ error: "Failed to load conversation" });
      }
    });

    this.app.get("/api/search", (req, res) => {
      try {
        const query = (req.query.query as string) || "";
        const projectPath = req.query.projectPath as string | undefined;
        const results = this.reader.searchConversations(query, projectPath);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: "Search failed" });
      }
    });

    this.app.get("*", (_, res) =>
      res.sendFile(path.join(__dirname, "../public/index.html"))
    );
  }

  private broadcast(msg: any) {
    this.wss?.clients.forEach(
      (c) => c.readyState === 1 && c.send(JSON.stringify(msg))
    );
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = this.app.listen(this.config.port, this.config.host, () => {
        const addr = srv.address();
        const port = typeof addr === "object" ? addr?.port : this.config.port;
        this.wss = new WebSocketServer({ server: srv });
        console.log(
          `🧠 Claude Memory Server: http://${this.config.host}:${port}`
        );
        console.log(`📂 Reading from: ${this.config.claudePath}`);
        resolve(port!);
      });
      srv.on("error", reject);
    });
  }

  stop() {
    this.watcher?.close();
    this.wss?.close();
  }
}
