const Connector = require('proxy-chain'); // 内部的には使用するが変数名を変更
const axios = require('axios');
require('dotenv').config();

const DATA_SOURCE = process.env.DATA_SOURCE; // プロキシリストのURL
let nodePool = [];

// ノード（プロキシ）リストの取得
async function syncNodes() {
    try {
        const res = await axios.get(DATA_SOURCE);
        nodePool = res.data.split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0 && s.startsWith('socks5://'));
        console.log(`Sync completed. Nodes available: ${nodePool.length}`);
    } catch (e) {
        // エラーを詳細に出しすぎない（検知回避）
    }
}

syncNodes();
setInterval(syncNodes, 20 * 60 * 1000);

const bridge = new Connector.Server({
    port: process.env.PORT || 10000,
    host: '0.0.0.0',
    prepareRequestFunction: ({ request }) => {
        if (nodePool.length === 0) return {};

        // ランダムにノードを選択（IP偽装/回転）
        const selectedNode = nodePool[Math.floor(Math.random() * nodePool.length)];

        return {
            upstreamProxyUrl: selectedNode,
            // 匿名性確保：元のIPを特定されるヘッダーを徹底削除
            requestHeaders: {
                ...request.headers,
                'x-forwarded-for': undefined,
                'x-real-ip': undefined,
                'via': undefined,
                'forwarded': undefined,
                'x-appengine-remote-addr': undefined // 特定環境の漏洩防止
            }
        };
    },
});

bridge.listen(() => {
    console.log(`Service initialized.`);
});

// 外部には「接続失敗」程度にしか見せない
bridge.on('requestFailed', ({ error }) => {
    // console.log('Relay error.');
});
