#!/usr/bin/env tsx

import { Database } from 'sqlite3';
import path from 'path';

// 數據庫文件路徑
const DB_PATH = path.join(process.cwd(), 'data', 'chat.db');

// 包裝 sqlite3 為 Promise
class DatabaseWrapper {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
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

async function verifyProjectIsolation() {
  const db = new DatabaseWrapper(DB_PATH);
  
  try {
    console.log('🔍 驗證專案間聊天室隔離...');
    
    // 1. 查看所有專案的聊天室
    const projects = await db.all(`
      SELECT 
        project_name,
        project_id,
        COUNT(*) as room_count,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created
      FROM chat_rooms 
      GROUP BY project_name, project_id
      ORDER BY project_name, project_id
    `);
    
    console.log('\n📊 專案聊天室統計:');
    projects.forEach(project => {
      console.log(`  專案: ${project.project_name} (ID: ${project.project_id})`);
      console.log(`    聊天室數量: ${project.room_count}`);
      console.log(`    首次創建: ${project.first_created}`);
      console.log(`    最後創建: ${project.last_created}`);
      console.log('');
    });
    
    // 2. 檢查是否有跨專案的聊天記錄混雜
    const crossProjectMessages = await db.all(`
      SELECT 
        cr.project_name,
        cr.project_id,
        cm.room_id,
        COUNT(*) as message_count
      FROM chat_messages cm
      JOIN chat_rooms cr ON cm.room_id = cr.id
      GROUP BY cr.project_name, cr.project_id, cm.room_id
      ORDER BY cr.project_name, cr.project_id
    `);
    
    console.log('📨 各聊天室訊息統計:');
    crossProjectMessages.forEach(stat => {
      console.log(`  專案: ${stat.project_name} | 聊天室: ${stat.room_id} | 訊息數: ${stat.message_count}`);
    });
    
    // 3. 檢查是否有重複的專案 ID
    const duplicateProjectIds = await db.all(`
      SELECT 
        project_id,
        COUNT(DISTINCT project_name) as name_count,
        GROUP_CONCAT(DISTINCT project_name) as project_names
      FROM chat_rooms 
      GROUP BY project_id
      HAVING name_count > 1
    `);
    
    if (duplicateProjectIds.length > 0) {
      console.log('\n⚠️  發現重複的專案 ID:');
      duplicateProjectIds.forEach(dup => {
        console.log(`  專案 ID: ${dup.project_id} 對應多個專案名稱: ${dup.project_names}`);
      });
    } else {
      console.log('\n✅ 沒有發現重複的專案 ID');
    }
    
    // 4. 檢查是否有孤立的訊息（沒有對應聊天室）
    const orphanedMessages = await db.get(`
      SELECT COUNT(*) as count
      FROM chat_messages cm
      LEFT JOIN chat_rooms cr ON cm.room_id = cr.id
      WHERE cr.id IS NULL
    `);
    
    if (orphanedMessages.count > 0) {
      console.log(`\n⚠️  發現 ${orphanedMessages.count} 條孤立訊息（沒有對應聊天室）`);
    } else {
      console.log('\n✅ 沒有發現孤立訊息');
    }
    
    // 5. 資料庫完整性檢查
    const totalRooms = await db.get('SELECT COUNT(*) as count FROM chat_rooms');
    const totalMessages = await db.get('SELECT COUNT(*) as count FROM chat_messages');
    
    console.log('\n📊 資料庫總覽:');
    console.log(`  總聊天室數: ${totalRooms.count}`);
    console.log(`  總訊息數: ${totalMessages.count}`);
    console.log(`  平均每聊天室訊息數: ${totalRooms.count > 0 ? (totalMessages.count / totalRooms.count).toFixed(2) : 0}`);
    
    console.log('\n✨ 專案隔離驗證完成!');
    
  } catch (error) {
    console.error('❌ 驗證過程中發生錯誤:', error);
  } finally {
    db.close();
  }
}

// 執行驗證
if (require.main === module) {
  verifyProjectIsolation().catch(console.error);
}

export { verifyProjectIsolation }; 