import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const stageInstructions = {
  ideas: `Создай ровно 10 идей для YouTube Shorts на заданную тему. Каждая идея должна иметь сильный хук в первые секунды, понятный угол подачи и краткое описание. Верни только JSON формата: {"ideas":[{"title":"","hook":"","angle":"","description":""}]}.`,
  script: `Создай готовый короткий сценарий для YouTube Shorts по выбранной идее. Верни только JSON формата: {"title":"","hook":"","script":"","duration_seconds":60}.`,
  scenes: `Разбей сценарий на последовательные сцены для вертикального YouTube Shorts. Для каждой сцены укажи номер, длительность, что зритель видит и текст озвучки. Верни только JSON формата: {"scenes":[{"number":1,"duration_seconds":5,"visual":"","voiceover":""}]}.`,
  prompts: `Создай промпты для генерации визуала каждой сцены. Промпты должны быть конкретными, кинематографичными и подходить для вертикального видео 9:16. Верни только JSON формата: {"prompts":[{"scene":1,"prompt":""}]}.`,
  voiceover: `Подготовь естественный текст озвучки для короткого ролика на русском языке. Раздели его по сценам. Верни только JSON формата: {"voiceover":"","segments":[{"scene":1,"text":""}]}.`,
  subtitles: `Подготовь субтитры для ролика с короткими читаемыми фразами и примерными временными интервалами. Верни только JSON формата: {"subtitles":[{"start":0,"end":3,"text":""}]}.`,
  montage: `Составь план монтажа вертикального Shorts: порядок сцен, переходы, эффекты, темп и рекомендации по музыке. Верни только JSON формата: {"plan":[{"scene":1,"instruction":""}],"music":"","effects":[""]}.`,
  viral: `Проанализируй ролик с точки зрения удержания внимания и потенциальной вирусности. Дай числовую оценку от 0 до 100, причины и конкретные улучшения. Верни только JSON формата: {"score":0,"reasons":[""],"improvements":[""]}.`,
  titles: `Создай 10 вариантов заголовка для YouTube Shorts. Они должны быть короткими, понятными и побуждать открыть ролик без обмана. Верни только JSON формата: {"titles":[""]}.`,
  seo: `Подготовь SEO для YouTube Shorts: описание, хэштеги и ключевые слова. Верни только JSON формата: {"description":"","hashtags":[""],"keywords":[""]}.`
};

function getOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function cleanJson(text) {
  let value = text.trim();
  value = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first >= 0 && last > first) {
    value = value.slice(first, last + 1);
  }
  return value;
}

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "SHORTS FACTORY AI" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/generate", async (req, res) => {
  try {
    const {
      stage = "ideas",
      topic,
      idea = "",
      title = "",
      context = ""
    } = req.body || {};

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ error: "Поле topic обязательно" });
    }

    if (!stageInstructions[stage]) {
      return res.status(400).json({ error: "Неизвестный stage" });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY не настроен на сервере" });
    }

    const systemPrompt = `Ты AI-движок приложения SHORTS FACTORY. Отвечай на русском языке. ${stageInstructions[stage]} Не добавляй Markdown, пояснения или текст вне JSON. JSON должен быть валидным.`;
    const userPrompt = [
      `Тема: ${topic.trim()}`,
      idea ? `Выбранная идея: ${idea}` : "",
      title ? `Выбранный заголовок: ${title}` : "",
      context ? `Дополнительный контекст: ${context}` : ""
    ].filter(Boolean).join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: "Ошибка OpenAI API",
        details: data?.error?.message || "Неизвестная ошибка"
      });
    }

    const outputText = getOutputText(data);
    if (!outputText) {
      return res.status(502).json({ error: "OpenAI не вернул текстовый результат" });
    }

    let result;
    try {
      result = JSON.parse(cleanJson(outputText));
    } catch {
      return res.status(502).json({
        error: "OpenAI вернул некорректный JSON",
        raw: outputText
      });
    }

    return res.json({
      ok: true,
      stage,
      result
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Ошибка сервера",
      details: error?.message || "Неизвестная ошибка"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SHORTS FACTORY AI server started on port ${PORT}`);
});
