/**
 * AI Content Generation for SEO/GEO
 * Uses Cloudflare Workers AI (free) to generate rich content from README
 */

export interface AiContent {
  ai_description: string;
  ai_faq: Array<{ q: string; a: string }>;
}

/** Fetch README from GitHub at a specific tag. Falls back to index.html if no README. */
export async function fetchReadme(
  owner: string,
  repo: string,
  tag: string,
  githubToken?: string
): Promise<string | null> {
  const headers: Record<string, string> = {
    'User-Agent': 'VibePub',
    'Accept': 'application/vnd.github.raw',
  };
  if (githubToken) headers['Authorization'] = `token ${githubToken}`;

  // Try README.md first
  for (const file of ['README.md', 'readme.md', 'Readme.md']) {
    const resp = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${tag}/${file}`,
      { headers }
    );
    if (resp.ok) return resp.text();
  }

  // Fallback: fetch index.html (every VibePub app has one)
  const indexResp = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${tag}/index.html`,
    { headers }
  );
  if (indexResp.ok) return indexResp.text();

  return null;
}

/** Generate SEO description + FAQ using Cloudflare Workers AI */
export async function generateAiContent(
  ai: any,
  appName: string,
  tagline: string,
  description: string,
  readmeRaw: string
): Promise<AiContent | null> {
  const truncatedReadme = readmeRaw.slice(0, 3000);

  const prompt = `You are an SEO and GEO (Generative Engine Optimization) expert writing content for a web app store.

App name: ${appName}
Tagline: ${tagline}
Developer description: ${description}

README excerpt:
${truncatedReadme}

Write a JSON response with exactly these two fields:
1. "ai_description": A 120-150 word SEO-optimized description. Start with "${appName} is". Explain what it does, who it's for, and key benefits. Use natural language that AI assistants would cite.
2. "ai_faq": Array of exactly 5 objects, each with "q" (question) and "a" (answer, 1-2 sentences). Questions should match what users or AI models would ask (e.g. "What does ${appName} do?", "Is ${appName} free?", "How do I use ${appName}?").

Respond ONLY with valid JSON. No markdown, no explanation.`;

  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
    });

    const text = response?.response || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.ai_description || !Array.isArray(parsed.ai_faq)) return null;

    return {
      ai_description: String(parsed.ai_description).slice(0, 1000),
      ai_faq: parsed.ai_faq.slice(0, 5).map((item: any) => ({
        q: String(item.q || ''),
        a: String(item.a || ''),
      })),
    };
  } catch (e) {
    console.error('AI content generation failed:', e);
    return null;
  }
}
