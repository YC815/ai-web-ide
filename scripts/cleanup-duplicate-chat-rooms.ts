#!/usr/bin/env tsx

import { Database } from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

// 數據庫文件路徑
const DB_PATH = path.join(process.cwd(), 'data', 'chat.db');

// 包裝 sqlite3 為 Promise
class DatabaseWrapper {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  async run(sql: string, params?: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params || [], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async all(sql: string, params?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params || [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async get(sql: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params || [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  close(): void {
    this.db.close();
  }
}

async function cleanupDuplicateChatRooms() {
  const db = new DatabaseWrapper(DB_PATH);
  
  try {
    console.log('🔍 開始清理重複聊天室...');
    
    // 1. 查看當前狀況
    const totalRooms = await db.get('SELECT COUNT(*) as count FROM chat_rooms');
    console.log(`📊 當前聊天室總數: ${totalRooms.count}`);
    
    // 2. 按專案分組查看聊天室數量
    const projectStats = await db.all(`
      SELECT project_name, COUNT(*) as room_count 
      FROM chat_rooms 
      GROUP BY project_name 
      ORDER BY room_count DESC
    `);
    
    console.log('\n📈 各專案聊天室數量:');
    projectStats.forEach(stat => {
      console.log(`  ${stat.project_name}: ${stat.room_count} 個聊天室`);
    });
    
    // 3. 對於每個專案，只保留最新的 3 個聊天室
    const KEEP_ROOMS_PER_PROJECT = 3;
    
    for (const project of projectStats) {
      if (project.room_count > KEEP_ROOMS_PER_PROJECT) {
        console.log(`\n🧹 清理專案 "${project.project_name}" 的聊天室...`);
        
        // 獲取該專案的所有聊天室，按創建時間排序
        const rooms = await db.all(`
          SELECT id, created_at 
          FROM chat_rooms 
          WHERE project_name = ? 
          ORDER BY created_at DESC
        `, [project.project_name]);
        
        // 要刪除的聊天室（除了最新的 3 個）
        const roomsToDelete = rooms.slice(KEEP_ROOMS_PER_PROJECT);
        
        console.log(`  保留最新的 ${KEEP_ROOMS_PER_PROJECT} 個聊天室`);
        console.log(`  將刪除 ${roomsToDelete.length} 個舊聊天室`);
        
        // 刪除聊天室及其相關訊息
        for (const room of roomsToDelete) {
          // 先刪除該聊天室的所有訊息
          await db.run('DELETE FROM chat_messages WHERE room_id = ?', [room.id]);
          // 再刪除聊天室
          await db.run('DELETE FROM chat_rooms WHERE id = ?', [room.id]);
        }
        
        console.log(`  ✅ 已刪除 ${roomsToDelete.length} 個聊天室`);
      }
    }
    
    // 4. 查看清理後的狀況
    const finalRooms = await db.get('SELECT COUNT(*) as count FROM chat_rooms');
    const finalMessages = await db.get('SELECT COUNT(*) as count FROM chat_messages');
    
    console.log('\n✨ 清理完成!');
    console.log(`📊 剩餘聊天室: ${finalRooms.count} 個`);
    console.log(`📊 剩餘訊息: ${finalMessages.count} 條`);
    console.log(`🗑️  已刪除 ${totalRooms.count - finalRooms.count} 個聊天室`);
    
    // 5. 清理資料庫（壓縮空間）
    await db.run('VACUUM');
    console.log('🔧 資料庫已優化');
    
  } catch (error) {
    console.error('❌ 清理過程中發生錯誤:', error);
  } finally {
    db.close();
  }
}

// 執行清理
if (require.main === module) {
  cleanupDuplicateChatRooms().catch(console.error);
}

export { cleanupDuplicateChatRooms }; 