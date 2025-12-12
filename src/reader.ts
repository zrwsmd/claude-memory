import fs from "fs";
import path from "path";
import os from "os";
import { ClaudeConversation, ClaudeMessage } from "./types";

export class ClaudeHistoryReader {
  private claudePath: string;

  constructor(claudePath?: string) {
    this.claudePath =
      claudePath || path.join(os.homedir(), ".claude", "projects");
  }

  private extractText(content: any): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (item.type === "text") return item.text || "";
          if (item.type === "tool_use") return `[Tool: ${item.name}]`;
          if (item.type === "tool_result") return "[Tool Result]";
          return "";
        })
        .join(" ")
        .trim();
    }
    return "";
  }

  private parseJsonlFile(filePath: string): ClaudeMessage[] {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      const messages: ClaudeMessage[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (
            entry.role &&
            (entry.role === "user" || entry.role === "assistant")
          ) {
            messages.push({
              role: entry.role,
              content: entry.content,
              timestamp: entry.timestamp || Date.now(),
            });
          }
        } catch (e) {
          // Skip invalid lines
        }
      }

      return messages;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }
  }

  getAllProjects(): Array<{
    path: string;
    name: string;
    conversationCount: number;
  }> {
    const projects: Array<{
      path: string;
      name: string;
      conversationCount: number;
    }> = [];

    if (!fs.existsSync(this.claudePath)) {
      console.log(`Claude directory not found: ${this.claudePath}`);
      return projects;
    }

    const projectDirs = fs
      .readdirSync(this.claudePath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const projectDir of projectDirs) {
      const projectPath = path.join(this.claudePath, projectDir);
      const files = fs
        .readdirSync(projectPath)
        .filter((file) => file.endsWith(".jsonl"));

      if (files.length > 0) {
        projects.push({
          path: projectDir,
          name: this.decodeProjectName(projectDir),
          conversationCount: files.length,
        });
      }
    }

    return projects.sort((a, b) => a.name.localeCompare(b.name));
  }

  getAllConversations(): ClaudeConversation[] {
    const conversations: ClaudeConversation[] = [];

    if (!fs.existsSync(this.claudePath)) {
      console.log(`Claude directory not found: ${this.claudePath}`);
      return conversations;
    }

    const projectDirs = fs
      .readdirSync(this.claudePath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const projectDir of projectDirs) {
      const projectPath = path.join(this.claudePath, projectDir);
      const files = fs
        .readdirSync(projectPath)
        .filter((file) => file.endsWith(".jsonl"));

      for (const file of files) {
        const filePath = path.join(projectPath, file);
        const messages = this.parseJsonlFile(filePath);

        if (messages.length > 0) {
          const firstUserMsg = messages.find((m) => m.role === "user");
          const firstMessage = firstUserMsg
            ? this.extractText(firstUserMsg.content).substring(0, 150)
            : "Empty conversation";

          const lastMsg = messages[messages.length - 1];
          const lastTimestamp = lastMsg.timestamp || Date.now();

          conversations.push({
            id: file.replace(".jsonl", ""),
            projectPath: projectDir,
            projectName: this.decodeProjectName(projectDir),
            messages,
            firstMessage,
            lastTimestamp,
            messageCount: messages.length,
            filePath,
          });
        }
      }
    }

    return conversations.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }

  getConversationsByProject(projectPath: string): ClaudeConversation[] {
    const conversations: ClaudeConversation[] = [];
    const fullProjectPath = path.join(this.claudePath, projectPath);

    if (!fs.existsSync(fullProjectPath)) {
      return conversations;
    }

    const files = fs
      .readdirSync(fullProjectPath)
      .filter((file) => file.endsWith(".jsonl"));

    for (const file of files) {
      const filePath = path.join(fullProjectPath, file);
      const messages = this.parseJsonlFile(filePath);

      if (messages.length > 0) {
        const firstUserMsg = messages.find((m) => m.role === "user");
        const firstMessage = firstUserMsg
          ? this.extractText(firstUserMsg.content).substring(0, 150)
          : "Empty conversation";

        const lastMsg = messages[messages.length - 1];

        conversations.push({
          id: file.replace(".jsonl", ""),
          projectPath,
          projectName: this.decodeProjectName(projectPath),
          messages,
          firstMessage,
          lastTimestamp: lastMsg.timestamp || Date.now(),
          messageCount: messages.length,
          filePath,
        });
      }
    }

    return conversations.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }

  getConversation(
    projectPath: string,
    conversationId: string
  ): ClaudeConversation | null {
    const filePath = path.join(
      this.claudePath,
      projectPath,
      `${conversationId}.jsonl`
    );

    if (!fs.existsSync(filePath)) return null;

    const messages = this.parseJsonlFile(filePath);
    if (messages.length === 0) return null;

    const firstUserMsg = messages.find((m) => m.role === "user");
    const firstMessage = firstUserMsg
      ? this.extractText(firstUserMsg.content).substring(0, 150)
      : "Empty conversation";

    const lastMsg = messages[messages.length - 1];

    return {
      id: conversationId,
      projectPath,
      projectName: this.decodeProjectName(projectPath),
      messages,
      firstMessage,
      lastTimestamp: lastMsg.timestamp || Date.now(),
      messageCount: messages.length,
      filePath,
    };
  }

  searchConversations(
    query: string,
    projectPath?: string
  ): ClaudeConversation[] {
    const allConversations = projectPath
      ? this.getConversationsByProject(projectPath)
      : this.getAllConversations();

    if (!query.trim()) return allConversations;

    const lowerQuery = query.toLowerCase();

    return allConversations.filter((conv) => {
      // Search in first message preview
      if (conv.firstMessage.toLowerCase().includes(lowerQuery)) return true;

      // Search in project name
      if (conv.projectName.toLowerCase().includes(lowerQuery)) return true;

      // Search in all message content
      return conv.messages.some((msg) => {
        const text = this.extractText(msg.content).toLowerCase();
        return text.includes(lowerQuery);
      });
    });
  }

  private decodeProjectName(encodedName: string): string {
    // Claude encodes paths like: -Users-username-projects-myproject
    // Decode back to readable format
    return (
      encodedName.replace(/^-+/, "").replace(/-+/g, "/").split("/").pop() ||
      encodedName
    );
  }
}
