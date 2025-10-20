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

        // 3. 检查密钥是否已被Web激活 (新逻辑: 如果已通过Web激活，则API验证失败)
        if (keyData.validation_status === 'web_used') {
            return response.status(403).json({ success: false, message: '此密钥已通过Web端激活，无法再通过API验证' }); // Web activated, API validation forbidden
        }
        
        // 4. 检查软件使用次数 (最多2次)
        // 确保 api_uses 是数字类型
        const apiUses = parseInt(keyData.api_uses || '0', 10);
        const MAX_API_USES = 2;

        if (apiUses >= MAX_API_USES) {
            return response.status(429).json({ success: false, message: `此密钥的软件验证次数已达上限 (${MAX_API_USES}次)` }); // Max API uses reached
        }
        
        // 5. 如果密钥有效且未达上限，则增加使用次数
        const newApiUses = apiUses + 1;
        const validationTime = new Date().toISOString();

        await kv.hset(`key:${key}`, {
            api_uses: newApiUses.toString(), // 存入数据库时转换为字符串
            last_api_validated_time: validationTime
        });
        
        // 6. 返回成功响应
        return response.status(200).json({ success: true, message: `密钥API验证成功 (第 ${newApiUses} 次使用)` }); // Key API validation successful

    } catch (error) {
        console.error('API Error in /api/validate-key-api:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' }); // Internal server error
    }
}