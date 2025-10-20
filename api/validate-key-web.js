import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' }); // Only POST requests allowed
    }
    try {
        const { key } = request.body;
        // Basic key format validation
        if (!key || typeof key !== 'string' || !/^[A-Za-z0-9]+$/.test(key) || key.length > 64) {
             return response.status(400).json({ success: false, message: '密钥格式无效' }); // Invalid key format
        }
        
        // 1. 在数据库中查找密钥
        const keyData = await kv.hgetall(`key:${key}`);

        // 2. 检查密钥是否存在
        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' }); // Key invalid or does not exist
        }

        // 3. 检查密钥是否已被Web激活 (只能激活一次)
        // 密钥状态现在可以是 'unused' (默认/管理端重置), 'web_used'
        if (keyData.validation_status === 'web_used') {
            return response.status(409).json({ success: false, message: '此密钥已通过Web端激活，如需重置请联系管理员' }); // Key already web activated
        }
        
        // ==========================================================
        // --- 核心修复点：使用扩展运算符确保保留所有原有数据 ---
        // ==========================================================
        // 4. 如果密钥有效且未被Web激活，则更新其状态为“web_used”
        const validationTime = new Date().toISOString();
        await kv.hset(`key:${key}`, {
            ...keyData, // <-- 保留所有旧的 Hash 字段 (如 key_value, created_at)
            validation_status: 'web_used',
            web_validated_time: validationTime,
            // 确保 api_uses 字段存在 (尽管它在 ...keyData 中可能已有，但此行可作为后备/显式覆盖)
            api_uses: keyData.api_uses || '0' 
        });
        
        // 5. 返回成功响应
        return response.status(200).json({ success: true, message: '密钥Web验证成功' }); // Key Web validation successful

    } catch (error) {
        console.error('API Error in /api/validate-key-web:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' }); // Internal server error
    }
}