# SHORTS FACTORY AI

Backend for the SHORTS FACTORY Android app.

## Run

```bash
npm install
npm start
```

## Environment variables

- `OPENAI_API_KEY` — OpenAI API key. Keep it only on the server.
- `OPENAI_MODEL` — optional model name. Default: `gpt-4.1-mini`.
- `PORT` — provided automatically by Render.

## API

`GET /health` — health check.

`POST /generate` — AI generation for the app stages.

Example request:

```json
{
  "stage": "ideas",
  "topic": "интересные факты о космосе"
}
```
