import type { Rule } from '../types';
import { DEFAULT_CATEGORIES } from './categories';

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
    const err = await response.text();
    throw new Error(`Erreur API Groq (${response.status}): ${err}`);
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
  } catch (e) {
    throw new Error('Impossible de décoder la réponse JSON de Groq.');
  }

  if (!Array.isArray(parsed)) {
    return { results: [], generatedRules: [] };
  }

  const results: GroqClassificationResult[] = [];
  const generatedRules: Rule[] = [];

  for (const item of parsed) {
    if (item.rawLabel && item.category) {
      results.push({
        rawLabel: item.rawLabel,
        cleanMerchant: item.cleanMerchant || item.rawLabel,
        category: item.category,
        suggestedKeyword: item.suggestedKeyword || item.cleanMerchant,
      });

      if (item.suggestedKeyword) {
        generatedRules.push({
          id: `rule_groq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          pattern: item.suggestedKeyword.toLowerCase().trim(),
          categoryId: item.category,
          targetMerchantName: item.cleanMerchant,
          priority: 60,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return { results, generatedRules };
}
