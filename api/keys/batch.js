import { kv } from '@vercel/kv';

// 身份验证函数
function checkAuth(password) {
    return password === process.env.ADMIN_PASSWORD;
}

// 随机密钥生成函数
const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'MSK' + randomPart;
};

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        // --- ▼▼▼ 核心修改点 开始 ▼▼▼ ---

        // 1. 从请求体中接收前端传来的 quantity 值
        const { quantity, password } = request.body;
        
        if (!checkAuth(password)) {
            return response.status(401).json({ success: false, message: '未经授权' });
        }

        // 2. 将前端传来的字符串数字转为整数，并增加安全校验
        const numToGenerate = parseInt(quantity, 10);
        if (isNaN(numToGenerate) || numToGenerate < 1 || numToGenerate > 100) {
             return response.status(400).json({ success: false, message: '无效的数量，必须是1到100之间的数字。' });
        }

        // 3. 移除了 const quantity = 10; 这一行硬编码

        // --- ▲▲▲ 核心修改点 结束 ▲▲▲ ---

        let added_count = 0;
        const generatedKeys = [];

        // 循环时使用经过校验的 numToGenerate 变量
        for (let i = 0; i < numToGenerate; i++) {
            let newKey, keyExists = true, attempts = 0;
            // 为防止极小概率的重复，尝试最多5次
            while(keyExists && attempts < 5) {
                newKey = generateRandomKey();
                keyExists = await kv.exists(`key:${newKey}`);
                attempts++;
            }
            
            // 如果5次后仍然重复，则跳过
            if (keyExists) {
                continue;
            }
            
            generatedKeys.push(newKey);
            const newKeyData = {
                key_value: newKey,
                validation_status: 'unused',
                created_at: new Date().toISOString(),
                web_validated_time: null,
                shortcut_configured_time: null
            };
            // 存入数据库
            await kv.hset(`key:${newKey}`, newKeyData);
            added_count++;
        }

        return response.status(201).json({ success: true, added_count, generatedKeys });

    } catch (error) {
        console.error('API Error in /api/keys/batch:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}