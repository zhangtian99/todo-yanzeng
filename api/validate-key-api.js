import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { key } = request.body;
        if (!key || typeof key !== 'string' || !/^[A-Za-z0-9]+$/.test(key) || key.length > 64) {
             return response.status(400).json({ success: false, message: '密钥格式无效' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);

        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        // 1. 检查密钥是否已被Web激活 (前置条件：必须是 'web_used' 状态)
        // 只有当 validation_status 是 'web_used' 时，API 验证才允许进行。
        if (keyData.validation_status !== 'web_used') {
            return response.status(403).json({ success: false, message: '密钥尚未通过Web端激活，请先在Web端完成激活' });
        }
        
        // 2. 检查软件使用次数 (最多2次)
        const apiUses = parseInt(keyData.api_uses || '0', 10);
        const MAX_API_USES = 2;

        if (apiUses >= MAX_API_USES) {
            return response.status(429).json({ success: false, message: `此密钥的软件验证次数已达上限 (${MAX_API_USES}次)` });
        }
        
        // 3. 增加使用次数并更新
        const newApiUses = apiUses + 1;
        const validationTime = new Date().toISOString();

        await kv.hset(`key:${key}`, {
            api_uses: newApiUses.toString(),
            last_api_validated_time: validationTime
            // 注意：不改变 validation_status，它保持 'web_used'
        });
        
        return response.status(200).json({ success: true, message: `密钥API验证成功 (第 ${newApiUses} 次使用)` });

    } catch (error) {
        console.error('API Error in /api/validate-key-api:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}