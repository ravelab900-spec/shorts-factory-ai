import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "SHORTS FACTORY AI" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const stageInstructions = {
  ideas: 'Return JSON: {"ideas":[{"title":"","hook":"","angle":"","description":""}]} with exactly 10 ideas.',
  script: 'Return JSON: {"title":"","hook":"","script":"","duration_seconds":30}',
  scenes: 'Return JSON: {"scenes":[{"number":1,"duration_seconds":5,"visual":"","voiceover":""}]}',
  prompts: 'Return JSON: {"prompts":[{"scene":1,"prompt":""}]}',
  voiceover: 'Return JSON: {"voiceover":"","segments":[{"scene":1,"text":""}]}',
  subtitles: 'Return JSON: {"subtitles":[{"start":0,"end":3,"text":""}]}',
  montage: 'Return JSON: {"plan":[{"scene":1,"start":0,"end":5}],"music":"","effects":[]}',
  viral: 'Return JSON: {"score":0,"reasons":[],"improvements":[]}',
  titles: 'Return JSON: {"titles":["","","","","","","","","",""]}',
  seo: 'Return JSON: {"description":"","hashtags":[],"keywords":[]}'
};

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("");
}

function cleanJson(text) {
  const cleaned = String(text)
    .trim()
    .replace(/^```json\\s*/i, "")
    .replace(/^```\\s*/i, "")
    .replace(/\\s*```$/i, "");
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1);
  return cleaned;
}

app.post("/generate", async (req, res) => {
  const {
    stage = "ideas",
    topic,
    idea = "",
    title = "",
    context = ""
  } = req.body || {};

  if (!topic || !String(topic).trim()) {
    return res.status(400).json({ error: "topic is required" });
  }

  if (!stageInstructions[stage]) {
    return res.status(400).json({ error: "unknown stage" });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  const systemPrompt = [
    "Ты AI-движок приложения SHORTS FACTORY.",
    "Отвечай на русском языке.",
    "Создавай идеи и материалы для коротких вертикальных видео YouTube Shorts.",
    "Пиши конкретно, динамично и без лишней воды.",
    "Не выдумывай факты как достоверные, если тема требует проверки.",
    stageInstructions[stage],
    "Верни только валидный JSON без markdown и без пояснений вне JSON."
  ].join(" ");

  const userPrompt = [
    `Тема: ${topic}`,
    `Идея: ${idea}`,
    `Заголовок: ${title}`,
    `Контекст: ${context}`
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
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
        error: "OpenAI API error",
        details: data.error?.message || "unknown"
      });
    }

    const text = extractOutputText(data);
    let result;

    try {
      result = JSON.parse(cleanJson(text));
    } catch {
      return res.status(502).json({
        error: "AI returned invalid JSON",
        raw: text.slice(0, 4000)
      });
    }

    return res.json({ ok: true, stage, result });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

app.use((err, _req, res, _next) => {
  res.status(500).json({
    error: "Internal server error",
    details: err.message
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SHORTS FACTORY AI listening on port ${PORT}`);
});
