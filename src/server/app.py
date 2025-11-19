from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage, AIMessage
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from fastapi import FastAPI, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from uuid import uuid4
from langgraph.checkpoint.memory import MemorySaver
from pathlib import Path
from functools import lru_cache
import pandas as pd
from sqlalchemy import create_engine, MetaData
from sqlalchemy.exc import SQLAlchemyError
import re

from sql_agent import agent

load_dotenv()


app = FastAPI()

ALLOWED_EXTENSIONS = {".xls", ".xlsx", ".csv", ".json", ".txt"}
TABULAR_EXTENSIONS = {".xls", ".xlsx", ".csv"}
UPLOAD_DIR = Path(__file__).resolve().parent / "uploaded_files"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://appuser:secret@postgres:5432/app"
)

@lru_cache(maxsize=1)
def get_db_engine():
    return create_engine(DATABASE_URL)

def sanitise_table_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", name.lower()).strip("_")
    if not cleaned:
        cleaned = "upload"
    return f"{cleaned}_{uuid4().hex[:8]}"

def ingest_tabular_file(file_path: Path, original_name: str):
    suffix = file_path.suffix.lower()
    if suffix not in TABULAR_EXTENSIONS:
        return None

    try:
        if suffix == ".csv":
            dataframe = pd.read_csv(file_path)
        else:
            dataframe = pd.read_excel(file_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse {original_name}: {exc}") from exc

    table_name = sanitise_table_name(Path(original_name).stem)

    try:
        engine = get_db_engine()
        dataframe.to_sql(table_name, engine, if_exists="replace", index=False)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Failed to write data to PostgreSQL.") from exc

    return {
        "tableName": table_name,
        "rows": len(dataframe.index),
        "columns": list(map(str, dataframe.columns))
    }

def drop_all_tables():
    try:
        engine = get_db_engine()
        metadata = MetaData()
        metadata.reflect(bind=engine)
        if metadata.tables:
            metadata.drop_all(bind=engine)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Failed to clear PostgreSQL tables.") from exc

# Add CORS middleware with settings that match frontend requirements
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"], 
    expose_headers=["Content-Type"], 
)

def serialise_ai_message_chunk(chunk): 
    if(isinstance(chunk, AIMessageChunk)):
        return chunk.content
    else:
        raise TypeError(
            f"Object of type {type(chunk).__name__} is not correctly formatted for serialisation"
        )

def format_sse_event(payload: dict) -> str:
    """Serialize payload to JSON and wrap it in an SSE data line."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

async def generate_chat_responses(message: str, checkpoint_id: Optional[str] = None):
    is_new_conversation = checkpoint_id is None
    
    if is_new_conversation:
        # Generate new checkpoint ID for first message in conversation
        new_checkpoint_id = str(uuid4())

        config = {
            "configurable": {
                "thread_id": new_checkpoint_id
            }
        }
        
        # Initialize with first message
        events = agent.astream_events(
            {"messages": [HumanMessage(content=message)]},
            version="v2",
            config=config
        )
        
        # First send the checkpoint ID
        yield format_sse_event({"type": "checkpoint", "checkpoint_id": new_checkpoint_id})
    else:
        config = {
            "configurable": {
                "thread_id": checkpoint_id
            }
        }
        # Continue existing conversation
        events = agent.astream_events(
            {"messages": [HumanMessage(content=message)]},
            version="v2",
            config=config
        )

    async for event in events:
        event_type = event["event"]
        print(event_type)
        
        if event_type == "on_chat_model_stream":
            chunk_content = serialise_ai_message_chunk(event["data"]["chunk"])
            
            yield format_sse_event({"type": "content", "content": chunk_content})
            
        elif event_type == "on_chat_model_end":
            # Check if there are tool calls for search
            tool_calls = event["data"]["output"].tool_calls if hasattr(event["data"]["output"], "tool_calls") else []
            search_calls = [call for call in tool_calls if call["name"] == "tavily_search_results_json"]
            
            if search_calls:
                # Signal that a search is starting
                search_query = search_calls[0]["args"].get("query", "")
                yield format_sse_event({"type": "search_start", "query": search_query})
                
        elif event_type == "on_tool_end" and event["name"] == "tavily_search_results_json":
            # Search completed - send results or error
            output = event["data"]["output"]
            
            # Check if output is a list 
            if isinstance(output, list):
                # Extract URLs from list of search results
                urls = []
                for item in output:
                    if isinstance(item, dict) and "url" in item:
                        urls.append(item["url"])
                
                # Convert URLs to JSON and yield them
                yield format_sse_event({"type": "search_results", "urls": urls})
    
    # Send an end event
    yield format_sse_event({"type": "end"})

@app.post("/files")
async def upload_files(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    saved_files = []

    for upload in files:
        suffix = Path(upload.filename).suffix.lower()

        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type for {upload.filename}.")

        contents = await upload.read()
        stored_name = f"{Path(upload.filename).stem}_{uuid4().hex}{suffix}"
        destination = UPLOAD_DIR / stored_name

        destination.write_bytes(contents)

        file_record = {
            "originalName": upload.filename,
            "storedName": stored_name,
            "size": len(contents)
        }

        if suffix in TABULAR_EXTENSIONS:
            ingestion_result = ingest_tabular_file(destination, upload.filename)
            if ingestion_result:
                file_record.update(ingestion_result)

        saved_files.append(file_record)

    return {
        "message": "Files uploaded successfully.",
        "files": saved_files
    }

@app.delete("/tables")
async def clear_tables():
    drop_all_tables()
    return {"message": "All tables deleted."}

@app.get("/chat_stream/{message}")
async def chat_stream(message: str, checkpoint_id: Optional[str] = Query(None)):
    return StreamingResponse(
        generate_chat_responses(message, checkpoint_id), 
        media_type="text/event-stream"
    )

# SSE - server-sent events 
