// 文件: /api/validate-key-web.js (Web 激活)
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: '仅允许POST请求' });
    }
    try {
        // Web激活只处理key
        const { key } = request.body; 
        
        if (!key) {
             return response.status(400).json({ success: false, message: '缺少密钥' });
        }
        
        const keyData = await kv.hgetall(`key:${key}`);

        if (!keyData) {
            return response.status(404).json({ success: false, message: '密钥无效或不存在' });
        }

        // 1. 检查密钥是否已被Web激活 (只能激活一次)
        // 状态：'unused' (未激活) -> 'web_used' (Web已激活)
        if (keyData.validation_status === 'web_used') {
            return response.status(409).json({ success: false, message: '此密钥已通过Web端激活，如需重置请联系管理员' });
        }
        
        // 检查密钥是否为初始的 'unused' 状态
        if (keyData.validation_status !== 'unused') {
            // 捕获其他非预期的状态，避免激活。
            return response.status(409).json({ success: false, message: `密钥状态为'${keyData.validation_status}'，无法通过Web激活。请联系管理员。` });
        }

        // 2. 激活流程：Web 端执行状态修改
        const validationTime = new Date().toISOString();
        
        await kv.hset(`key:${key}`, {
            ...keyData, // <<-- 保持所有原有数据 (例如 created_at)
            validation_status: 'web_used', // 设为 Web 已激活
            web_validated_time: validationTime,
            // 确保 api_uses 被初始化 (如果它之前不存在的话)
            api_uses: keyData.api_uses || '0', 
            shortcut_configured_time: keyData.shortcut_configured_time || null,
        });

        const responseData = {
            key_value: keyData.key_value,
            validation_status: 'web_used',
            web_validated_time: validationTime,
        };

        return response.status(200).json({ 
            success: true, 
            message: `密钥Web激活成功。`,
            data: responseData
        });

    } catch (error) {
        console.error('Web激活API出错:', error);
        return response.status(500).json({ success: false, message: '服务器内部错误' });
    }
}