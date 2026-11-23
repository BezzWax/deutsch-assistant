export interface RecognizedWord {
	original: string;
	lemma: string;
	partOfSpeech: string;
	forms: string;
	translation: string;
	context: string;
	confidence: number;
}

interface GeminiResponse {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				text?: string;
			}>;
		};
	}>;
	error?: {
		message?: string;
	};
}

export class GeminiService {
	private static readonly MODEL = 'gemini-3.8-flash';

	private static readonly API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent`;

	static async analyzeImage(
		file: File,
		apiKey: string,
	): Promise<RecognizedWord[]> {
		if (!apiKey.trim()) {
			throw new Error('Gemini API key is missing.');
		}

		const base64 = await this.fileToBase64(file);

		let response: Response | null = null;
		let data: GeminiResponse = {};

		const maxAttempts = 3;

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			response = await fetch(this.API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-goog-api-key': apiKey,
				},
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: this.getPrompt(),
								},
								{
									inlineData: {
										mimeType: file.type,
										data: base64,
									},
								},
							],
						},
					],
					generationConfig: {
						responseMimeType: 'application/json',
						temperature: 0.2,
					},
				}),
			});

			data = (await response.json()) as GeminiResponse;

			if (response.ok) {
				break;
			}

			const isTemporaryError = [500, 502, 503, 504].includes(
				response.status,
			);

			if (!isTemporaryError || attempt === maxAttempts - 1) {
				throw new Error(
					`Gemini API error (${response.status}): ${
						data.error?.message ?? 'Unknown API error.'
					}`,
				);
			}

			const delay = 1500 * 2 ** attempt;

			console.warn(
				`Gemini temporarily unavailable. Retry ${attempt + 1}/${maxAttempts} in ${delay}ms.`,
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
		}

		if (!response?.ok) {
			throw new Error('Gemini request failed after multiple attempts.');
		}

		const generatedText = data.candidates?.[0]?.content?.parts
			?.map((part) => part.text ?? '')
			.join('')
			.trim();

		if (!generatedText) {
			throw new Error('Gemini returned an empty response.');
		}

		return this.parseResponse(generatedText);
	}

	private static getPrompt(): string {
		return `
You are an expert German language teacher.

Analyze this photograph of a German textbook page.

Your task:
1. Identify ONLY German words or expressions that are visibly underlined.
2. Do not include words that are not underlined.
3. Read the surrounding sentence to understand the meaning.
4. Determine the dictionary form (lemma).
5. Identify the part of speech.
6. Provide the relevant grammatical forms.
7. Translate the word into Russian according to its context.
8. Include the original sentence or a short surrounding context.
9. Estimate recognition confidence from 0 to 1.

Rules:
- For nouns, include the correct German article in the lemma.
- For verbs, use the infinitive as the lemma.
- For separable verbs, preserve the separable prefix.
- For verbs, forms should contain: 3rd person singular present,
  simple past, and past participle.
- For nouns, forms should contain the plural form.
- For adjectives, include comparative and superlative when applicable.
- If a form cannot be determined reliably, leave it empty.
- Never invent an underlined word if you cannot clearly see it.
- If the underline is ambiguous, lower the confidence.

Return ONLY valid JSON in this exact structure:

{
  "words": [
    {
      "original": "vorbereitet",
      "lemma": "vorbereiten",
      "partOfSpeech": "verb",
      "forms": "bereitet vor · bereitete vor · hat vorbereitet",
      "translation": "подготавливать, подготовить",
      "context": "Ich habe alles für die Prüfung vorbereitet.",
      "confidence": 0.95
    }
  ]
}

If no underlined words are found, return:
{
  "words": []
}
`;
	}

	private static parseResponse(response: string): RecognizedWord[] {
		const parsed: unknown = JSON.parse(response);

		console.log(response);

		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('words' in parsed) ||
			!Array.isArray(parsed.words)
		) {
			throw new Error('Gemini returned an invalid JSON structure.');
		}

		return parsed.words.map((item: unknown) => {
			if (typeof item !== 'object' || item === null) {
				throw new Error('Gemini returned an invalid word.');
			}

			const word = item as Record<string, unknown>;

			const requiredFields = [
				'original',
				'lemma',
				'partOfSpeech',
				'forms',
				'translation',
				'context',
			];

			for (const field of requiredFields) {
				if (typeof word[field] !== 'string') {
					throw new Error(`Invalid or missing field: ${field}`);
				}
			}

			const confidence =
				typeof word.confidence === 'number'
					? Math.max(0, Math.min(1, word.confidence))
					: 0;

			return {
				original: word.original as string,
				lemma: word.lemma as string,
				partOfSpeech: word.partOfSpeech as string,
				forms: word.forms as string,
				translation: word.translation as string,
				context: word.context as string,
				confidence,
			};
		});
	}

	private static async fileToBase64(file: File): Promise<string> {
		const buffer = await file.arrayBuffer();
		const bytes = new Uint8Array(buffer);

		let binary = '';

		const chunkSize = 0x8000;

		for (let i = 0; i < bytes.length; i += chunkSize) {
			const chunk = bytes.subarray(i, i + chunkSize);
			binary += String.fromCharCode(...chunk);
		}

		return btoa(binary);
	}
}
