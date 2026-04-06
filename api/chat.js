import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, messages } = req.body || {};

        const history = Array.isArray(messages) ? messages : [];
        const latestMessage = message || '';

        if (!latestMessage && history.length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const inputMessages = [
            {
                role: 'system',
                content:
                    '你是李佳阳个人网站上的数字分身助手。回答要专业、清晰、简洁。只回答和他的经历、项目、技能、AI产品方法论相关的问题；不知道就直说不知道，不要编造。'
            },
            ...history,
            ...(latestMessage ? [{ role: 'user', content: latestMessage }] : [])
        ];

        const response = await client.responses.create({
            model: 'gpt-5.4-mini',
            input: inputMessages
        });

        return res.status(200).json({
            reply: response.output_text
        });
    } catch (error) {
        console.error('OpenAI error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
