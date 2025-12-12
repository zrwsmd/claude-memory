import fs from "fs";
import path from "path";
import os from "os";
import { ClaudeConversation, ClaudeMessage } from "./types";

export class ClaudeHistoryReader {
  private claudePath: string;

  constructor(claudePath?: string) {
    this.claudePath =
      claudePath || path.join(os.homedir(), ".claude", "projects");
    //console.log(`[Claude Memory] Reading projects from path: ${this.claudePath}`);
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
          // New format: role is the top-level type, and content is nested in `message`
          if (
            (entry.type === "user" || entry.type === "assistant") &&
            entry.message
          ) {
            messages.push({
              role: entry.message.role || entry.type,
              content: entry.message.content,
              timestamp: entry.timestamp || Date.now(),
            });
          }
        } catch (e) {
          // Skip invalid lines, but log it for debugging
          console.warn(
            `[Claude Memory] Skipping invalid line in ${filePath}: ${line.substring(
              0,
              100
            )}...`
          );
        }
      }

      console.log(
        `[Claude Memory] Parsed ${messages.length} messages from ${filePath}`
      );
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

    if (!query || !query.trim()) {
      return allConversations;
    }

    const lowerQuery = query.toLowerCase();
    const results: ClaudeConversation[] = [];

    for (const conv of allConversations) {
      let snippet: string | null = null;

      // First, search in message content
      for (const msg of conv.messages) {
        try {
          const text = this.extractText(msg.content);
          const index = text.toLowerCase().indexOf(lowerQuery);

          if (index !== -1) {
            // Found it! Extract a window of text AROUND the keyword
            // Take 30 chars before and 100 chars after, roughly
            const start = Math.max(0, index - 30);
            const end = Math.min(text.length, index + query.length + 100);

            snippet = text.substring(start, end);

            // Add ellipsis if we truncated
            if (start > 0) snippet = "..." + snippet;
            if (end < text.length) snippet = snippet + "...";

            break;
          }
        } catch (e) {
          console.error(`Error processing message content in conversation ${conv.id}`, e);
        }
      }

      // If no match in content, check project name
      if (!snippet) {
        if (conv.projectName && conv.projectName.toLowerCase().includes(lowerQuery)) {
          snippet = `Matched in project name: ${conv.projectName}`;
        }
      }

      if (snippet) {
        const matchedConv = { ...conv };
        // We already truncated specifically around the keyword, so use it directly
        matchedConv.searchSnippet = snippet;
        results.push(matchedConv);
      }
    }

    console.log(`[Claude Memory] Found ${results.length} results for query "${lowerQuery}".`);
    return results;
  }

  private decodeProjectName(encodedName: string): string {
    // Claude encodes windows paths like e:\claude-project\my-project
    // into a single folder name: e--claude-project-my-project
    // The path separator becomes '--'. We want to extract the final component.
    const parts = encodedName.split(/--/);
    return parts[parts.length - 1] || encodedName;
  }
}
