// 文件: /api/validate.js (API/Shortcut 验证 - 兼容版本)
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: '仅允许POST请求' });
    }
    try {
        const { key } = request.body; 
        
        if (!key) {
             return response.status(400).json({ code: 'INVALID_INPUT', message: '缺少密钥' });
        }
        
        const keyName = `key:${key}`;
        const keyData = await kv.hgetall(keyName);
        
        if (!keyData) {
            return response.status(404).json({ code: 'KEY_NOT_FOUND', message: '密钥无效或不存在' });
        }

        // 1. 检查试用密钥是否过期 (保持原逻辑)
        if (keyData.key_type === 'trial' && keyData.expires_at && new Date() > new Date(keyData.expires_at)) {
            return response.status(403).json({ code: 'KEY_EXPIRED', message: '试用密钥已过期，请购买永久密钥。' });
        }
        
        // ==========================================================
        // --- 核心兼容点 1：检查 Web 验证状态 (必须是已激活状态) ---
        // ==========================================================
        // 密钥可能被设置为 'used' 或 'web_used'，兼容两者。
        const isActive = keyData.validation_status === 'used' || keyData.validation_status === 'web_used';

        if (!isActive) {
            return response.status(401).json({ code: 'NOT_ACTIVATED', message: '请先在Web页面完成激活。' });
        }

        // ==========================================================
        // --- 核心兼容点 2：检查 API 验证次数限制 (兼容不同计数器名称) ---
        // ==========================================================
        // 优先使用 'api_checks' (原 validate.js)，其次使用 'api_uses' (其他文件)，默认 0。
        const apiChecksKey = keyData.api_checks !== undefined ? 'api_checks' : 'api_uses';
        const apiChecks = parseInt(keyData[apiChecksKey] || 0, 10);
        const MAX_CHECKS = 2; // 最多验证 2 次
        
        if (apiChecks >= MAX_CHECKS) {
            return response.status(403).json({ code: 'CHECK_LIMIT_EXCEEDED', message: `API 验证次数已达上限（${MAX_CHECKS}次）。` });
        }
        
        // 3. 验证通过：递增计数器
        const newApiChecks = apiChecks + 1;
        const validationTime = new Date().toISOString();
        
        // 递增时，使用检测到的准确键名进行 HSET
        await kv.hset(keyName, { 
            ...keyData, // 保持所有原有数据
            [apiChecksKey]: newApiChecks.toString(), // 使用兼容的键名进行递增
            last_api_validated_time: validationTime
        });

        const responseData = {
            key_type: keyData.key_type || 'permanent',
            expires_at: keyData.expires_at || null,
            validation_status: keyData.validation_status,
            user_id: keyData.user_id || null,
            api_checks_remaining: MAX_CHECKS - newApiChecks,
            api_checks_used: newApiChecks
        };

        return response.status(200).json({ 
            code: 'VALIDATION_SUCCESS', 
            message: `验证成功。这是第 ${newApiChecks} 次验证。`, 
            data: responseData
        });
        
    } catch (error) {
        console.error('API 密钥验证出错:', error);
        return response.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: '服务器内部错误' });
    }
}
//11