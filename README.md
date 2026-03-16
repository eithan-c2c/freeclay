# FreeGTM

Open-source data enrichment tool. Import a CSV, add AI-powered columns (Claude or Gemini), and export the results. No accounts, no storage, no cost — you bring your own API key.

## Features

- **CSV Import** — Drag & drop or upload `.csv`, `.xlsx`, `.xls` files
- **AI Enrichment** — Add columns powered by Claude (Anthropic) or Gemini (Google) with web search
- **HTTP Columns** — Call any API per row with URL templates (`{{column_name}}`)
- **BYOK** — Bring Your Own Key. Your API key stays in browser memory, never stored or logged
- **Full Spreadsheet** — Sort, filter, resize, reorder, rename, duplicate, delete columns
- **Keyboard Navigation** — Arrow keys, Tab, Enter, Ctrl+C/V, Ctrl+Z/Y
- **Undo/Redo** — 50-level history for all data operations
- **Export** — Download as CSV or JSON

## Quick Start

```bash
git clone https://github.com/eithan-c2c/freegtm.git
cd freegtm
npm install
npm run dev
```

Open [http://localhost:3000/tool](http://localhost:3000/tool)

## Get an API Key

### Anthropic (Claude)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and add credits ($5 minimum)
3. Go to API Keys → Create Key
4. Copy the key starting with `sk-ant-...`

### Google (Gemini)
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Copy the key starting with `AIza...`

## How to Use

1. **Import data** — Click "Importer CSV" or drag & drop a file onto the table
2. **Add your API key** — Click "Claude" or "Gemini" in the toolbar, paste your key, click "Valider"
3. **Add an enrichment column** — Click the `+` button on the right side of the table → "Enrichissement IA"
4. **Configure** — Choose your model, select input columns, describe what you want to extract
5. **Run** — Click the play button on the column header
6. **Export** — Click "CSV" or "JSON" in the toolbar

## Example Use Cases

| Input | Enrichment | Output |
|-------|-----------|--------|
| Company names | "Find the company website and industry" | Website URL, Industry |
| LinkedIn URLs | "Extract the person's current role and company size" | Role, Company Size |
| Product names | "Classify this product into a category" | Category |
| City names | "What is the population and country?" | Population, Country |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` `↓` `←` `→` | Navigate between cells |
| `Tab` / `Shift+Tab` | Next / previous cell |
| `Enter` | Next row |
| `Ctrl+C` | Copy selection (TSV) |
| `Ctrl+V` | Paste from clipboard |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Double-click` | Edit a cell or rename a column |
| `Right-click` on header | Column context menu |

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com)
- [@tanstack/react-table](https://tanstack.com/table) for the spreadsheet
- [@dnd-kit](https://dndkit.com) for drag & drop column reorder
- No database — fully stateless, everything in-memory

## Privacy

- API keys live in React `useState()` only — never `localStorage`, never cookies, never server-side
- API routes are thin proxies — they forward your key to Claude/Gemini and return the result
- No analytics cookies, no tracking, no user accounts
- All data stays in your browser tab. Close the tab = data gone.

## Self-Host with Docker

```bash
git clone https://github.com/eithan-c2c/freegtm.git
cd freegtm
docker compose up -d --build
```

The app will be available on port 3000.

## License

MIT

---

Built by [Eithan Benero](https://www.linkedin.com/in/eithan-benero/) — [cold-to-cash.com](https://cold-to-cash.com)
