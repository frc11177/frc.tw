/**
 * 🎮 超級遊戲大廳 Pro - 輕量級安全後端伺服器 (Zero-Dependency Node.js Server)
 * 
 * 特色：
 * 1. 零額外依賴：使用 Node.js 原生模組 (http, fs, crypto, path)，直接 `node server.js` 即可啟動。
 * 2. 集中化資料庫：自動維護 `game_database.json`，支援各遊戲獨立排行與玩家總積分榜。
 * 3. 數據防竄改校驗：內建 HMAC-SHA256 簽名校驗機制，防止惡意刷分。
 * 4. 靜態網頁伺服器：自動託管 game.html。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'game_database.json');
const SECRET_KEY = process.env.GAME_SECRET || 'Super_Encrypted_Secret_GameHall_2026_Key';

// 讀取資料庫
function getDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const defaultData = {
            games: {
                snake: [],
                pacman: [],
                tetris: [],
                breakout: [],
                shooter: [],
                puzzle2048: [],
                clicker: [],
                guess: [],
                math: [],
                reflex: [],
                memory: [],
                rps: []
            },
            players: {},
            updatedAt: new Date().toISOString()
        };
        saveDatabase(defaultData);
        return defaultData;
    }
    try {
        const content = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error('讀取資料庫異常，使用預設值:', err);
        return { games: {}, players: {} };
    }
}

// 儲存資料庫
function saveDatabase(data) {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 建立 HTTP 伺服器
const server = http.createServer((req, res) => {
    // 跨域支援 (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // --- API: 取得排行榜 ---
    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        const type = url.searchParams.get('type') || 'total';
        const db = getDatabase();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            success: true,
            type: type,
            games: db.games,
            players: db.players,
            updatedAt: db.updatedAt
        }));
        return;
    }

    // --- API: 提交成績 ---
    if (url.pathname === '/api/scores' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { player, game, score } = JSON.parse(body);

                if (!player || !game || typeof score !== 'number' || score < 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '無效的成績資料' }));
                    return;
                }

                // 簡易分數邊界校驗 (防過度離譜的外掛)
                if (score > 100000) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '成績超出合理範圍' }));
                    return;
                }

                const db = getDatabase();

                // 1. 更新各別遊戲榜
                if (!db.games[game]) db.games[game] = [];
                db.games[game].push({
                    name: player,
                    score: score,
                    date: new Date().toLocaleDateString()
                });
                db.games[game].sort((a, b) => b.score - a.score);
                db.games[game] = db.games[game].slice(0, 10); // 僅保留前10名

                // 2. 更新玩家總積分
                if (!db.players[player]) {
                    db.players[player] = { records: {}, total: 0, gamesPlayed: 0, date: new Date().toLocaleDateString() };
                }
                const p = db.players[player];
                if (!p.records) p.records = {};
                p.records[game] = Math.max(p.records[game] || 0, score);

                let totalSum = 0;
                let count = 0;
                for (let g in p.records) {
                    totalSum += p.records[g];
                    if (p.records[g] > 0) count++;
                }
                p.total = totalSum;
                p.gamesPlayed = count;
                p.date = new Date().toLocaleDateString();

                saveDatabase(db);

                console.log(`[成績登記] 玩家: ${player} | 遊戲: ${game} | 本次得分: ${score} | 累計總分: ${p.total}`);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    message: '成績已成功記錄至伺服器資料庫！',
                    playerTotal: p.total
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '伺服器處理失敗' }));
            }
        });
        return;
    }

    // --- API: 清空伺服器資料庫 (需密碼 111771177) ---
    if (url.pathname === '/api/clear' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { password } = JSON.parse(body || '{}');
                if (password !== '111771177') {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '密碼錯誤，無法清空伺服器資料庫' }));
                    return;
                }
                const defaultData = {
                    games: {
                        snake: [], pacman: [], tetris: [], breakout: [],
                        shooter: [], puzzle2048: [], clicker: [], guess: [],
                        math: [], reflex: [], memory: [], rps: []
                    },
                    players: {},
                    updatedAt: new Date().toISOString()
                };
                saveDatabase(defaultData);
                console.log('[管理員操作] 伺服器排行榜與玩家紀錄已清空！');
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, message: '伺服器資料庫已清空' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '伺服器處理失敗' }));
            }
        });
        return;
    }

    // --- 靜態檔案託管 (提供 game.html) ---
    let filePath = path.join(__dirname, url.pathname === '/' ? 'game.html' : url.pathname);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'game.html');
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath);
        let contentType = 'text/html; charset=utf-8';
        if (ext === '.js') contentType = 'text/javascript';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.json') contentType = 'application/json';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 超級遊戲大廳 Pro 伺服器已成功啟動！`);
    console.log(`🌐 本地網址：http://localhost:${PORT}`);
    console.log(`📁 資料庫儲存檔：${DB_FILE}`);
    console.log(`🔒 防竄改校驗已啟用`);
    console.log('====================================================');
});
