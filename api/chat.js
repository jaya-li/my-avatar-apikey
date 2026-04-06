import fs from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

function setCors(res) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

let knowledgeMarkdownCache = null;

function loadKnowledgeMarkdown() {
    if (knowledgeMarkdownCache !== null) {
        return knowledgeMarkdownCache;
    }

    try {
        const dir = path.join(process.cwd(), 'knowledge');

        if (!fs.existsSync(dir)) {
            console.warn('knowledge dir not found:', dir);
            knowledgeMarkdownCache = '';
            return knowledgeMarkdownCache;
        }

        const names = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.md'))
            .sort();

        const chunks = [];

        for (const name of names) {
            const full = path.join(dir, name);
            const text = fs.readFileSync(full, 'utf8');
            chunks.push(`## ${name}\n\n${text.trim()}`);
        }

        knowledgeMarkdownCache = chunks.join('\n\n---\n\n');
        return knowledgeMarkdownCache;
    } catch (error) {
        console.error('Failed to load knowledge files:', error);
        knowledgeMarkdownCache = '';
        return knowledgeMarkdownCache;
    }
}

function buildSystemPrompt() {
    const knowledge = loadKnowledgeMarkdown();

    const basePrompt = `
你是李佳阳的数字分身。

你必须使用第一人称“我”来回答。
你的回答应该像真人说话，不要像文档，不要像客服。

回答规则：
1. 默认回答控制在 3 到 4 句话。
2. 不要过度分点，除非用户明确要求列出。
3. 优先依据知识库内容回答。
4. 如果知识库没有写到，明确说“资料里没有写到”或“当前知识库未覆盖”，不要编造。
5. 回答风格要专业、清晰、克制，有判断，但不要过度展开。
6. 优先回答和我的经历、项目、技能、AI 产品方法论、合作方向相关的问题。
7. 如果涉及隐私、敏感信息、未公开信息，不要回答。
`.trim();

    if (!knowledge) {
        return `${basePrompt}\n\n当前没有加载到知识库内容。`;
    }

    return `${basePrompt}\n\n以下是我的知识库内容，请优先依据这些内容回答：\n\n${knowledge}`;
}

export default async function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

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
                content: buildSystemPrompt()
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
