// 文件: reset-key.js
import { kv } from '@vercel/kv';

// 身份验证函数
function checkAuth(password) {
    return password === process.env.ADMIN_PASSWORD;
}

export default async function handler(request, response) {
    // 之前您要求的API响应格式修改 (success -> code)
    if (request.method !== 'POST') {
        return response.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: '仅允许POST请求' });
    }

    try {
        const { key_value, password } = request.body;

        if (!checkAuth(password)) {
            return response.status(401).json({ code: 'UNAUTHORIZED', message: '未经授权' });
        }

        if (!key_value) {
            return response.status(400).json({ code: 'INVALID_INPUT', message: '缺少密钥值' });
        }

        const keyName = `key:${key_value}`;
        const keyExists = await kv.exists(keyName);
        if (!keyExists) {
            return response.status(404).json({ code: 'KEY_NOT_FOUND', message: '密钥不存在' });
        }

        // 先获取现有数据，再更新特定字段
        const existingData = await kv.hgetall(keyName);

        // --- 核心修改点：重置 API 验证次数和状态 ---
        const resetTime = new Date().toISOString();
        
        // 确保同时重置 Web 状态和 API 计数器
        const updateFields = {
            ...existingData, // 保留所有旧数据
            validation_status: 'unused', // 重置为未激活状态
            // 清空 Web/Shortcut 相关的验证时间
            web_validated_time: null, 
            shortcut_configured_time: null,
            activated_at: null,
            last_api_validated_time: null,
            // 兼容地将两种可能的 API 计数器字段都重置为 '0'
            api_checks: '0', 
            api_uses: '0', 
            reset_at: resetTime // 记录重置时间
        };

        await kv.hset(keyName, updateFields);

        // 之前您要求的API响应格式修改 (success -> code)
        return response.status(200).json({ 
            code: 'KEY_RESET_SUCCESS', 
            message: `密钥 ${key_value} 已成功重置为未使用状态，API验证次数已清零。` 
        });

    } catch (error) {
        console.error('重置密钥API出错:', error);
        // 之前您要求的API响应格式修改 (success -> code)
        return response.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: '服务器内部错误' });
    }
}