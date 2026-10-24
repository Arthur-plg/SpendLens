import type { Rule } from '../types';
import { DEFAULT_CATEGORIES } from './categories';
import { normalize } from './rules';

const VALID_CATEGORIES = new Set(
  DEFAULT_CATEGORIES.map((c) => c.id).filter((id) => !['autre', 'revenus', 'virement_interne'].includes(id)),
);

export interface GroqClassificationResult {
  rawLabel: string;
  cleanMerchant: string;
  category: string;
  suggestedKeyword: string;
}

/**
 * Call Groq API with Llama-3.1-8B to batch-classify unknown transactions
 */
export async function batchClassifyWithGroq(
  apiKey: string,
  labels: { rawLabel: string; amount: number }[]
): Promise<{ results: GroqClassificationResult[]; generatedRules: Rule[] }> {
  if (!apiKey || labels.length === 0) {
    return { results: [], generatedRules: [] };
  }

  const categoryList = DEFAULT_CATEGORIES.map((c) => `- "${c.id}": ${c.name}`).join('\n');

  // Limit to max 25 distinct items to save tokens & latency
  const uniqueLabels = Array.from(new Set(labels.map((l) => l.rawLabel))).slice(0, 25);

  const prompt = `Tu es un assistant financier expert. Voici une liste de libellés bancaires français à classifier.
Choisis STRICTEMENT parmi ces catégories existantes :
${categoryList}

Pour chaque libellé, réponds au format JSON valide strict :
[
  {
    "rawLabel": "libellé original exact",
    "cleanMerchant": "Nom propre et clair du commerçant ou service",
    "category": "l'un des id de catégories listés ci-dessus (ex: alimentation, restaurants, abonnements, etc.)",
    "suggestedKeyword": "un mot-clé distinctif ou regex simple pour reconnaître ce commerçant à l'avenir"
  }
]

Voici les libellés à classifier :
${JSON.stringify(uniqueLabels, null, 2)}
`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Tu es un parseur financier JSON. Réponds UNIQUEMENT un tableau JSON valide sans markdown, sans bavardage.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    console.error('Groq error', response.status, await response.text());
    if (response.status === 401 || response.status === 403) {
      throw new Error('Clé refusée par Groq. Vérifiez-la ou créez-en une nouvelle.');
    }
    if (response.status === 429) throw new Error('Limite Groq atteinte. Réessayez dans une minute.');
    throw new Error('Groq n’a pas pu classer les libellés. Réessayez plus tard.');
  }

  const data = await response.json();
  const rawContent = data.choices[0]?.message?.content || '{}';

  let parsed: any;
  try {
    parsed = JSON.parse(rawContent);
    // Groq json_object might return { "items": [...] } or direct array
    if (parsed.items && Array.isArray(parsed.items)) {
      parsed = parsed.items;
    } else if (parsed.results && Array.isArray(parsed.results)) {
      parsed = parsed.results;
    } else if (!Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      for (const k of keys) {
        if (Array.isArray(parsed[k])) {
          parsed = parsed[k];
          break;
        }
      }
    }
  } catch {
    throw new Error('Groq n’a pas pu classer les libellés. Réessayez plus tard.');
  }

  if (!Array.isArray(parsed)) {
    return { results: [], generatedRules: [] };
  }

  const results: GroqClassificationResult[] = [];
  const generatedRules: Rule[] = [];

  for (const item of parsed) {
    // Only accept real spending categories: income or transfer would silently move money out of the totals.
    if (typeof item?.rawLabel !== 'string' || !VALID_CATEGORIES.has(item.category)) continue;
    const cleanMerchant = typeof item.cleanMerchant === 'string' && item.cleanMerchant.trim() ? item.cleanMerchant.trim() : item.rawLabel;
    const keyword = String(item.suggestedKeyword ?? '').toLowerCase().trim();
    results.push({ rawLabel: item.rawLabel, cleanMerchant, category: item.category, suggestedKeyword: keyword });

    // Keep a rule only if the keyword is specific and actually occurs in the label it came from.
    if (keyword.length >= 4 && normalize(item.rawLabel).includes(normalize(keyword))) {
      generatedRules.push({
        id: `rule_groq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        pattern: keyword,
        categoryId: item.category,
        targetMerchantName: cleanMerchant,
        priority: 60,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return { results, generatedRules };
}
