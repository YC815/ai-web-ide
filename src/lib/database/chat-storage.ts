// SQLite 聊天記錄儲存管理器
// 負責管理聊天室、訊息和上下文的持久化儲存
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 確保資料庫目錄存在
const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'chat.db');

// 聊天室介面
export interface ChatRoom {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  containerId?: string;
  createdAt: string;
  lastActivity: string;
  isActive: boolean;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  metadata?: Record<string, any>;
}

// 聊天訊息介面
export interface ChatMessage {
  id: string;
  roomId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens?: number;
  cost?: number;
  toolCallsExecuted?: number;
  metadata?: Record<string, any>;
}

// 聊天上下文介面
export interface ChatContext {
  id: string;
  roomId: string;
  contextType: 'project_info' | 'conversation_summary' | 'tool_usage' | 'user_preference';
  contextKey: string;
  contextValue: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

/**
 * SQLite 聊天儲存管理器
 */
export class ChatStorageManager {
  private db: Database.Database;
  private static instance: ChatStorageManager;

  private constructor() {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  /**
   * 獲取單例實例
   */
  static getInstance(): ChatStorageManager {
    if (!ChatStorageManager.instance) {
      ChatStorageManager.instance = new ChatStorageManager();
    }
    return ChatStorageManager.instance;
  }

  /**
   * 初始化資料庫表結構
   */
  private initializeDatabase(): void {
    // 創建聊天室表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project_id TEXT NOT NULL,
        project_name TEXT NOT NULL,
        container_id TEXT,
        created_at TEXT NOT NULL,
        last_activity TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        total_messages INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0.0,
        metadata TEXT
      )
    `);

    // 創建聊天訊息表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        tokens INTEGER,
        cost REAL,
        tool_calls_executed INTEGER,
        metadata TEXT,
        FOREIGN KEY (room_id) REFERENCES chat_rooms (id) ON DELETE CASCADE
      )
    `);

    // 創建聊天上下文表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_contexts (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        context_type TEXT NOT NULL,
        context_key TEXT NOT NULL,
        context_value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        FOREIGN KEY (room_id) REFERENCES chat_rooms (id) ON DELETE CASCADE
      )
    `);

    // 創建索引以提高查詢效能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages (room_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages (timestamp);
      CREATE INDEX IF NOT EXISTS idx_chat_contexts_room_id ON chat_contexts (room_id);
      CREATE INDEX IF NOT EXISTS idx_chat_contexts_type_key ON chat_contexts (context_type, context_key);
      CREATE INDEX IF NOT EXISTS idx_chat_rooms_project_id ON chat_rooms (project_id);
      CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_activity ON chat_rooms (last_activity);
    `);

    console.log('🗄️ SQLite 聊天資料庫初始化完成');
  }

  /**
   * 創建新聊天室
   */
  createChatRoom(room: Omit<ChatRoom, 'createdAt' | 'lastActivity'>): ChatRoom {
    const now = new Date().toISOString();
    const newRoom: ChatRoom = {
      ...room,
      createdAt: now,
      lastActivity: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO chat_rooms (
        id, title, project_id, project_name, container_id, 
        created_at, last_activity, is_active, total_messages, 
        total_tokens, total_cost, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      newRoom.id,
      newRoom.title,
      newRoom.projectId,
      newRoom.projectName,
      newRoom.containerId || null,
      newRoom.createdAt,
      newRoom.lastActivity,
      newRoom.isActive ? 1 : 0,
      newRoom.totalMessages,
      newRoom.totalTokens,
      newRoom.totalCost,
      newRoom.metadata ? JSON.stringify(newRoom.metadata) : null
    );

    console.log(`💬 創建新聊天室: ${newRoom.id} (${newRoom.title})`);
    return newRoom;
  }

  /**
   * 獲取聊天室
   */
  getChatRoom(roomId: string): ChatRoom | null {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_rooms WHERE id = ?
    `);
    
    const row = stmt.get(roomId) as any;
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      projectId: row.project_id,
      projectName: row.project_name,
      containerId: row.container_id,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      isActive: row.is_active === 1,
      totalMessages: row.total_messages,
      totalTokens: row.total_tokens,
      totalCost: row.total_cost,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * 獲取專案的所有聊天室
   */
  getChatRoomsByProject(projectId: string): ChatRoom[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_rooms 
      WHERE project_id = ? 
      ORDER BY last_activity DESC
    `);
    
    const rows = stmt.all(projectId) as any[];
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      projectId: row.project_id,
      projectName: row.project_name,
      containerId: row.container_id,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      isActive: row.is_active === 1,
      totalMessages: row.total_messages,
      totalTokens: row.total_tokens,
      totalCost: row.total_cost,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * 更新聊天室
   */
  updateChatRoom(roomId: string, updates: Partial<ChatRoom>): boolean {
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.isActive !== undefined) {
      updateFields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (updates.totalMessages !== undefined) {
      updateFields.push('total_messages = ?');
      values.push(updates.totalMessages);
    }
    if (updates.totalTokens !== undefined) {
      updateFields.push('total_tokens = ?');
      values.push(updates.totalTokens);
    }
    if (updates.totalCost !== undefined) {
      updateFields.push('total_cost = ?');
      values.push(updates.totalCost);
    }
    if (updates.metadata !== undefined) {
      updateFields.push('metadata = ?');
      values.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
    }

    // 總是更新最後活動時間
    updateFields.push('last_activity = ?');
    values.push(new Date().toISOString());

    if (updateFields.length === 1) return true; // 只有 last_activity 更新

    values.push(roomId);

    const stmt = this.db.prepare(`
      UPDATE chat_rooms 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  /**
   * 刪除聊天室（及其所有訊息和上下文）
   */
  deleteChatRoom(roomId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM chat_rooms WHERE id = ?');
    const result = stmt.run(roomId);
    
    if (result.changes > 0) {
      console.log(`🗑️ 刪除聊天室: ${roomId}`);
    }
    
    return result.changes > 0;
  }

  /**
   * 添加聊天訊息
   */
  addChatMessage(message: ChatMessage): boolean {
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (
        id, room_id, role, content, timestamp, 
        tokens, cost, tool_calls_executed, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      message.id,
      message.roomId,
      message.role,
      message.content,
      message.timestamp,
      message.tokens || null,
      message.cost || null,
      message.toolCallsExecuted || null,
      message.metadata ? JSON.stringify(message.metadata) : null
    );

    // 更新聊天室統計
    if (result.changes > 0) {
      this.updateRoomStats(message.roomId, message.tokens || 0, message.cost || 0);
    }

    return result.changes > 0;
  }

  /**
   * 獲取聊天室的訊息歷史
   */
  getChatMessages(roomId: string, limit: number = 50, offset: number = 0): ChatMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_messages 
      WHERE room_id = ? 
      ORDER BY timestamp ASC 
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(roomId, limit, offset) as any[];
    return rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: row.timestamp,
      tokens: row.tokens,
      cost: row.cost,
      toolCallsExecuted: row.tool_calls_executed,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * 獲取最近的聊天訊息（用於上下文）
   */
  getRecentMessages(roomId: string, count: number = 10): ChatMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_messages 
      WHERE room_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(roomId, count) as any[];
    return rows.reverse().map(row => ({
      id: row.id,
      roomId: row.room_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: row.timestamp,
      tokens: row.tokens,
      cost: row.cost,
      toolCallsExecuted: row.tool_calls_executed,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * 設置聊天上下文
   */
  setChatContext(context: ChatContext): boolean {
    const now = new Date().toISOString();
    
    // 先嘗試更新現有上下文
    const updateStmt = this.db.prepare(`
      UPDATE chat_contexts 
      SET context_value = ?, updated_at = ?, expires_at = ?
      WHERE room_id = ? AND context_type = ? AND context_key = ?
    `);

    const updateResult = updateStmt.run(
      context.contextValue,
      now,
      context.expiresAt || null,
      context.roomId,
      context.contextType,
      context.contextKey
    );

    if (updateResult.changes > 0) {
      return true;
    }

    // 如果沒有現有記錄，則插入新記錄
    const insertStmt = this.db.prepare(`
      INSERT INTO chat_contexts (
        id, room_id, context_type, context_key, context_value,
        created_at, updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertResult = insertStmt.run(
      context.id,
      context.roomId,
      context.contextType,
      context.contextKey,
      context.contextValue,
      now,
      now,
      context.expiresAt || null
    );

    return insertResult.changes > 0;
  }

  /**
   * 獲取聊天上下文
   */
  getChatContext(roomId: string, contextType: string, contextKey: string): ChatContext | null {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_contexts 
      WHERE room_id = ? AND context_type = ? AND context_key = ?
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    `);
    
    const row = stmt.get(roomId, contextType, contextKey) as any;
    if (!row) return null;

    return {
      id: row.id,
      roomId: row.room_id,
      contextType: row.context_type,
      contextKey: row.context_key,
      contextValue: row.context_value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }

  /**
   * 獲取聊天室的所有上下文
   */
  getAllChatContexts(roomId: string): ChatContext[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_contexts 
      WHERE room_id = ?
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY updated_at DESC
    `);
    
    const rows = stmt.all(roomId) as any[];
    return rows.map(row => ({
      id: row.id,
      roomId: row.room_id,
      contextType: row.context_type,
      contextKey: row.context_key,
      contextValue: row.context_value,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * 更新聊天室統計
   */
  private updateRoomStats(roomId: string, tokenDelta: number, costDelta: number): void {
    const stmt = this.db.prepare(`
      UPDATE chat_rooms 
      SET total_messages = total_messages + 1,
          total_tokens = total_tokens + ?,
          total_cost = total_cost + ?,
          last_activity = ?
      WHERE id = ?
    `);

    stmt.run(tokenDelta, costDelta, new Date().toISOString(), roomId);
  }

  /**
   * 清理過期的上下文
   */
  cleanupExpiredContexts(): number {
    const stmt = this.db.prepare(`
      DELETE FROM chat_contexts 
      WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')
    `);

    const result = stmt.run();
    if (result.changes > 0) {
      console.log(`🧹 清理了 ${result.changes} 個過期的聊天上下文`);
    }
    
    return result.changes;
  }

  /**
   * 清理舊的聊天室（超過指定天數且非活躍）
   */
  cleanupOldChatRooms(daysOld: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const stmt = this.db.prepare(`
      DELETE FROM chat_rooms 
      WHERE is_active = 0 AND last_activity < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    if (result.changes > 0) {
      console.log(`🧹 清理了 ${result.changes} 個舊的聊天室`);
    }
    
    return result.changes;
  }

  /**
   * 獲取資料庫統計資訊
   */
  getStorageStats(): {
    totalRooms: number;
    activeRooms: number;
    totalMessages: number;
    totalContexts: number;
    dbSizeKB: number;
  } {
    const roomsStmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_rooms');
    const activeRoomsStmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_rooms WHERE is_active = 1');
    const messagesStmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_messages');
    const contextsStmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_contexts');

    const totalRooms = (roomsStmt.get() as any).count;
    const activeRooms = (activeRoomsStmt.get() as any).count;
    const totalMessages = (messagesStmt.get() as any).count;
    const totalContexts = (contextsStmt.get() as any).count;

    // 獲取資料庫檔案大小
    let dbSizeKB = 0;
    try {
      const stats = fs.statSync(dbPath);
      dbSizeKB = Math.round(stats.size / 1024);
    } catch (error) {
      console.warn('無法獲取資料庫檔案大小:', error);
    }

    return {
      totalRooms,
      activeRooms,
      totalMessages,
      totalContexts,
      dbSizeKB,
    };
  }

  /**
   * 關閉資料庫連接
   */
  close(): void {
    this.db.close();
  }
}

// 導出單例實例
export const chatStorage = ChatStorageManager.getInstance(); 