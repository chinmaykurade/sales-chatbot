# Sales Chatbot

A full-stack AI assistant that lets analysts chat with their sales data. The project pairs a FastAPI + LangGraph backend (SQL-aware agent, file ingestion, SSE streaming) with a Next.js client that renders the conversation UI. Uploaded tabular files are stored in PostgreSQL where the SQL agent can reason over them, audit its queries, and stream answers back to the browser.

- **Backend:** FastAPI, LangChain/LangGraph, PostgreSQL, Tavily, OpenAI (`src/server`)
- **Frontend:** Next.js 15 + React 19 single-page chat interface (`src/client`)
- **Infrastructure:** Docker Compose definition for Postgres + server + client (`src/docker-compose.yml`)

## Repository Layout

- `src/server/` - FastAPI app (`app.py`), LangGraph nodes (`nodes.py`), prompts, SQL agent wiring, and requirements.
- `src/client/` - Next.js app with SSE-powered chat (`src/app/page.tsx`) and supporting components/assets.
- `src/docker-compose.yml` - Spins up PostgreSQL, the server, and the client with the correct volumes and network.
- `dataset/` - Sample data you can upload to seed the agent.

## Prerequisites

- Node.js 18+ and npm for the client.
- Python 3.10+ with `pip` for the FastAPI server.
- Docker + Docker Compose (optional but recommended for one-command start).
- PostgreSQL 15+ (Compose already provisions it; otherwise point `DATABASE_URL` at your own instance).
- API keys: OpenAI (for GPT models) and Tavily (for web search fallbacks).

## Environment Variables

Create `src/server/.env` with:

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | Secret key used by `ChatOpenAI` in `nodes.py` and `app.py`. |
| `TAVILY_API_KEY` | Enables the Tavily search tool when the agent needs fresh information. |
| `DATABASE_URL` | SQLAlchemy/Postgres URL (defaults to `postgresql+psycopg2://appuser:secret@postgres:5432/app`). |

For the client, set `NEXT_PUBLIC_SERVER_URL` (e.g., `http://localhost:8000`) when running outside Compose so the browser knows where to open the SSE stream (`EventSource` in `src/client/src/app/page.tsx`).

> WARNING If Tavily requests fail due to SSL verification errors, install updated certificates (`pip install certifi` followed by `Install Certificates.command` on macOS) as noted in `src/server/README.md`.

## Quick Start with Docker Compose

```bash
cd src
docker compose up --build
```

This command launches:
1. `postgres` with a volume at `postgres_data`.
2. `server` (FastAPI). It mounts `src/server` into the container and exposes port `8000`.
3. `client` (Next.js) exposed on port `3000`, pre-configured with `NEXT_PUBLIC_SERVER_URL=http://server:8000`.

Open `http://localhost:3000` to use the chatbot. Uploaded files are persisted under `src/server/uploaded_files` and ingested into the running Postgres service.

## Manual Development Setup

### Backend (FastAPI + LangGraph)

```bash
cd src/server
python -m venv .venv
.venv\Scripts\activate        # On macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Ensure PostgreSQL is reachable at the `DATABASE_URL` in your `.env`. The defaults point to the Compose service (`appuser/secret@app`). You can also run a standalone Postgres container:

```bash
docker run -d --name sales-chatbot-postgres -e POSTGRES_PASSWORD=secret -e POSTGRES_USER=appuser -e POSTGRES_DB=app -p 5432:5432 postgres:15-alpine
```

### Frontend (Next.js)

```bash
cd src/client
npm install
NEXT_PUBLIC_SERVER_URL=http://localhost:8000 npm run dev
```

Visit `http://localhost:3000`. The client opens `EventSource` connections to `GET /chat_stream/{message}` and renders streamed tokens, tool-call notifications, and search-stage badges.

## Working with Data & APIs

The backend exposes a minimal REST surface (`src/server/app.py`):

- `POST /files` - Accepts multiple `.csv`, `.xls`, `.xlsx`, `.json`, or `.txt` files. Tabular files are parsed with Pandas and stored in Postgres using a sanitised table name (`ingest_tabular_file` and `sanitise_table_name`). The response includes inferred schema metadata so the UI can confirm ingestion.
- `DELETE /tables` - Drops every table in the configured Postgres database (`drop_all_tables`) so you can start fresh between sessions.
- `GET /chat_stream/{message}` - Streams LangGraph events over Server-Sent Events (SSE). Messages include `checkpoint` (conversation ID), `content` (LLM tokens), `tool_call` (whenever a SQL tool or search is invoked), and `end`.

Uploaded binaries land in `src/server/uploaded_files`, and any CSV/Excel file automatically becomes a SQL table the agent can query.

## SQL Agent Workflow

The SQL agent lives in `src/server/sql_agent.py` and `src/server/nodes.py`. It uses LangGraph's state machine plus LangChain's `SQLDatabaseToolkit` to safely generate, verify, and execute SQL.

1. **State tracking** - `State` keeps the running `messages` list (LangChain format) plus an optional `intent`.
2. **Intent detection (`intent_detection`)** - Examines the most recent human input. If "summarize" is detected it injects a specialised summarization prompt; otherwise it routes into a standard Q&A flow (`nodes.py:33-71`).
3. **Table discovery (`list_tables`)** - Calls the toolkit's `sql_db_list_tables` tool so the agent can reflect the current schema (especially useful after uploading CSV/XLSX files).
4. **Schema inspection (`call_get_schema` -> `get_schema`)** - Binds the `sql_db_schema` tool, prompting the LLM to retrieve column definitions for relevant tables before writing SQL.
5. **Query drafting (`generate_query`)** - Prepends `generate_query_system_prompt` (limits results, forbids DML) and lets the LLM either answer directly or call the `sql_db_query` tool with a proposed SQL statement (`nodes.py:81-110`).
6. **Guardrail (`should_continue` + `check_query`)** - If the model requested a tool call, the graph routes through `check_query`, which re-checks the SQL using `check_query_system_prompt`. This catches common mistakes (NULL handling, joins, incorrect functions) before execution.
7. **Execution & iteration (`run_query_node`)** - The verified SQL hits Postgres through the toolkit's `sql_db_query` tool. Results are appended to the conversation, giving the LLM grounded context. The graph then loops back to `generate_query` so the LLM can interpret the results and craft the natural-language answer.
8. **Memory & streaming** - `sql_agent.py` compiles the graph with `MemorySaver`, enabling long-running conversations keyed by the `checkpoint_id` that the server hands back to the UI (`app.py:40-126`). The FastAPI endpoint streams each `AIMessageChunk` so tokens appear live on the frontend.

Because schema inspection and query checking are enforced as graph edges, the agent consistently sees up-to-date metadata and only executes SQL that passes validation.

## Running Tests & Validation

There is no dedicated automated test suite yet. To validate changes:

1. Upload the CSV/XLSX samples under `dataset/` via the UI or `POST /files`.
2. Ask natural-language questions (e.g., "Which region had the highest quarterly revenue?") and confirm the SQL emitted in the server logs matches expectations.
3. Clear the database with `DELETE /tables` between major experiments.

## Next Steps

- Deploy the stack to your preferred platform (Render, Fly, AWS ECS) using the same Compose services as a blueprint.
- Extend the LangGraph flow with additional tools (Tavily web search is already imported and ready to expose) or add intent branches for forecasting/report generation.
- Tighten observability by persisting LangSmith run traces or adding FastAPI logging middleware.


