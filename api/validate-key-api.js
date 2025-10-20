// 文件: /api/validate-key-api.js (API/Shortcut 验证)
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        const { key } = request.body;
        // ... (密钥格式校验，这里简化)
        
        const keyData = await kv.hgetall(`key:${key}`);
        const keyName = `key:${key}`;

        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        // 1. 【核心前置检查】：必须是 'web_used' 状态才能进行API验证
        if (keyData.validation_status !== 'web_used') {
            return response.status(403).json({ success: false, message: '密钥尚未通过Web端激活，请先在Web端完成激活' });
        }
        
        // 2. 检查软件使用次数 (最多2次)
        const apiUses = parseInt(keyData.api_uses || '0', 10);
        const MAX_API_USES = 2; // 您可以根据需要修改此上限

        if (apiUses >= MAX_API_USES) {
            return response.status(429).json({ success: false, message: `此密钥的软件验证次数已达上限 (${MAX_API_USES}次)` });
        }
        
        // 3. 验证通过：增加使用次数并更新时间
        const newApiUses = apiUses + 1;
        const validationTime = new Date().toISOString();

        await kv.hset(keyName, {
            ...keyData, // <<-- 保持所有原有数据
            api_uses: newApiUses.toString(), // 递增使用次数
            shortcut_configured_time: validationTime // 记录最后一次配置时间
        });

        return response.status(200).json({ 
            success: true, 
            message: `API验证成功，当前使用次数: ${newApiUses}`,
            data: {
                key_value: keyData.key_value,
                api_uses: newApiUses,
                shortcut_configured_time: validationTime
            }
        });

    } catch (error) {
        console.error('API验证API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}