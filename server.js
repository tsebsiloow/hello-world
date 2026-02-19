const ProxyChain = require('proxy-chain');
const axios = require('axios');
require('dotenv').config();

const PROXY_LIST_URL = process.env.PROXY_LIST_URL || "https://raw.githubusercontent.com/dpangestuw/Free-Proxy/refs/heads/main/socks5_proxies.txt";
let validProxies = [];

// プロキシの生存確認 & リスト更新
async function refreshProxyList() {
    try {
        console.log('Fetching fresh proxy list...');
        const response = await axios.get(PROXY_LIST_URL);
        const rawList = response.data.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.startsWith('socks5://'));

        // ここでは全件を一旦セット（より高度にするなら疎通確認を入れる）
        validProxies = rawList;
        console.log(`Loaded ${validProxies.length} proxies.`);
    } catch (err) {
        console.error('Failed to update proxy list:', err.message);
    }
}

// 初回実行と定期更新（30分おき）
refreshProxyList();
setInterval(refreshProxyList, 30 * 60 * 1000);

const server = new ProxyChain.Server({
    port: process.env.PORT || 10000,
    prepareRequestFunction: ({ request }) => {
        if (validProxies.length === 0) return {};

        // ランダムにプロキシを選択（IP回転）
        const upstreamProxy = validProxies[Math.floor(Math.random() * validProxies.length)];

        return {
            upstreamProxyUrl: upstreamProxy,
            // 匿名性向上のためのヘッダー削除（IP漏洩防止）
            requestHeaders: {
                ...request.headers,
                'x-forwarded-for': undefined,
                'x-real-ip': undefined,
                'via': undefined,
                'forwarded': undefined
            }
        };
    },
});

server.listen(() => {
    console.log(`Proxy server is running on port ${server.port}`);
});

// エラーハンドリング（無料プロキシ起因の切断を許容）
server.on('requestFailed', ({ error }) => {
    console.log(`Proxy request failed: ${error.message}`);
});
