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
          // Skip invalid lines
        }
      }

      return messages;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }
  }

  private isConversationEmpty(messages: ClaudeMessage[]): boolean {
    if (messages.length === 0) return true;

    return messages.every((m) => {
      const text = this.extractText(m.content);
      return !text || text.trim().length === 0;
    });
  }

  /**
   * Calculate relevance score for a conversation based on where the keyword appears
   * Higher score = more relevant
   * PRIMARY FACTOR: Message count (indicates conversation depth/importance)
   */
  private calculateRelevanceScore(
    conv: ClaudeConversation,
    query: string
  ): { score: number; snippet: string; matchType: string } {
    const lowerQuery = query.toLowerCase();
    let score = 0;
    let snippet = "";
    let matchType = "";

    // 1. MESSAGE COUNT - PRIMARY RANKING FACTOR (up to 3000 points)
    // More messages = more important/detailed conversation
    const messageScore = Math.min(conv.messageCount * 5, 3000);
    score += messageScore;

    // 2. Check first message (conversation title) - HIGH priority
    const firstUserMsg = conv.messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      const firstText = this.extractText(firstUserMsg.content);
      const firstIndex = firstText.toLowerCase().indexOf(lowerQuery);

      if (firstIndex !== -1) {
        score += 50; // Title match bonus
        matchType = "title";

        // Extract snippet around match
        const start = Math.max(0, firstIndex - 30);
        const end = Math.min(firstText.length, firstIndex + query.length + 100);
        snippet = firstText.substring(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < firstText.length) snippet = snippet + "...";

        // Bonus: exact match at the beginning of first message
        if (firstIndex === 0) {
          score += 30;
        }
        // Bonus: match in first 50 characters
        else if (firstIndex < 50) {
          score += 15;
        }
      }
    }

    // 3. Check project name - MEDIUM priority
    if (conv.projectName?.toLowerCase().includes(lowerQuery)) {
      score += 30;
      if (!snippet) {
        snippet = `Matched in project: ${conv.projectName}`;
        matchType = "project";
      }
    }

    // 4. Count occurrences in all messages - MEDIUM priority
    let totalOccurrences = 0;
    let earliestMessageIndex = -1;

    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      const text = this.extractText(msg.content).toLowerCase();
      const occurrences = (text.match(new RegExp(lowerQuery, "gi")) || [])
        .length;

      if (occurrences > 0) {
        totalOccurrences += occurrences;
        if (earliestMessageIndex === -1) {
          earliestMessageIndex = i;
        }

        // If we don't have a snippet yet, grab it from first occurrence
        if (!snippet) {
          const index = text.indexOf(lowerQuery);
          const originalText = this.extractText(msg.content);
          const start = Math.max(0, index - 30);
          const end = Math.min(originalText.length, index + query.length + 100);
          snippet = originalText.substring(start, end);
          if (start > 0) snippet = "..." + snippet;
          if (end < originalText.length) snippet = snippet + "...";
          matchType = "message";
        }
      }
    }

    // Add score based on number of occurrences (max +30)
    score += Math.min(totalOccurrences * 3, 30);

    // 5. Small bonus for appearing early in conversation
    if (earliestMessageIndex !== -1) {
      if (earliestMessageIndex === 0) {
        score += 10; // First message
      } else if (earliestMessageIndex < 3) {
        score += 5; // Within first 3 messages
      }
    }

    // 6. Minor bonus for recent conversations
    const daysSinceLastUpdate =
      (Date.now() - conv.lastTimestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceLastUpdate < 1) {
      score += 10; // Updated today
    } else if (daysSinceLastUpdate < 7) {
      score += 5; // Updated this week
    }

    return { score, snippet, matchType };
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

      let validCount = 0;
      for (const file of files) {
        const filePath = path.join(projectPath, file);
        const messages = this.parseJsonlFile(filePath);
        if (!this.isConversationEmpty(messages)) {
          validCount++;
        }
      }

      if (validCount > 0) {
        projects.push({
          path: projectDir,
          name: this.decodeProjectName(projectDir),
          conversationCount: validCount,
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

        if (this.isConversationEmpty(messages)) {
          continue;
        }

        const firstUserMsg = messages.find((m) => m.role === "user");
        const firstMessage = firstUserMsg
          ? this.extractText(firstUserMsg.content).substring(0, 150)
          : "Empty conversation";

        const stats = fs.statSync(filePath);
        const lastTimestamp = stats.mtimeMs;

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

      if (this.isConversationEmpty(messages)) {
        continue;
      }

      const firstUserMsg = messages.find((m) => m.role === "user");
      const firstMessage = firstUserMsg
        ? this.extractText(firstUserMsg.content).substring(0, 150)
        : "Empty conversation";

      const stats = fs.statSync(filePath);
      const lastTimestamp = stats.mtimeMs;

      conversations.push({
        id: file.replace(".jsonl", ""),
        projectPath,
        projectName: this.decodeProjectName(projectPath),
        messages,
        firstMessage,
        lastTimestamp,
        messageCount: messages.length,
        filePath,
      });
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

    if (this.isConversationEmpty(messages)) return null;

    const firstUserMsg = messages.find((m) => m.role === "user");
    const firstMessage = firstUserMsg
      ? this.extractText(firstUserMsg.content).substring(0, 150)
      : "Empty conversation";

    const stats = fs.statSync(filePath);
    const lastTimestamp = stats.mtimeMs;

    return {
      id: conversationId,
      projectPath,
      projectName: this.decodeProjectName(projectPath),
      messages,
      firstMessage,
      lastTimestamp,
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
    const scoredResults: Array<{
      conversation: ClaudeConversation;
      score: number;
      snippet: string;
      matchType: string;
    }> = [];

    // Score each conversation
    for (const conv of allConversations) {
      const { score, snippet, matchType } = this.calculateRelevanceScore(
        conv,
        query
      );

      if (score > 0 && snippet) {
        scoredResults.push({
          conversation: conv,
          score,
          snippet,
          matchType,
        });
      }
    }

    // Sort by relevance score (highest first)
    scoredResults.sort((a, b) => b.score - a.score);

    // Convert back to conversations with snippets
    const results = scoredResults.map(
      ({ conversation, snippet, score, matchType }) => {
        const matchedConv = { ...conversation };
        matchedConv.searchSnippet = snippet;

        // Optional: Add score and match type for debugging
        // You can display this in the UI if you want
        (matchedConv as any).relevanceScore = score;
        (matchedConv as any).matchType = matchType;

        return matchedConv;
      }
    );

    console.log(
      `[Claude Memory] Found ${results.length} results for "${lowerQuery}".`
    );
    console.log(
      `Top 3 scores: ${results
        .slice(0, 3)
        .map((r: any) => `${r.relevanceScore} (${r.matchType})`)
        .join(", ")}`
    );

    return results;
  }

  private decodeProjectName(encodedName: string): string {
    const parts = encodedName.split(/--/);
    return parts[parts.length - 1] || encodedName;
  }
}
