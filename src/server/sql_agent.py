
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, MessagesState, StateGraph

import os
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from typing import TypedDict, Annotated, Optional
from langgraph.graph import StateGraph, END

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

from nodes import (intent_router, 
                   intent_detection, 
                   list_tables,
                   call_get_schema,
                   generate_query,
                   get_schema_node,
                   check_query,
                   run_query_node,
                   should_continue,
                   model,
                   State)

load_dotenv()

memory = MemorySaver()


builder = StateGraph(State)
builder.add_node("intent_detection", intent_detection)
builder.add_node("list_tables", list_tables)
builder.add_node("call_get_schema", call_get_schema)
builder.add_node("get_schema", get_schema_node)
builder.add_node("generate_query", generate_query)
builder.add_node("check_query", check_query)
builder.add_node("run_query", run_query_node)
builder.add_node("model", model)

builder.add_conditional_edges("intent_detection", intent_router)
builder.add_edge(START, "intent_detection")
builder.add_edge("list_tables", "call_get_schema")
builder.add_edge("call_get_schema", "get_schema")
builder.add_edge("get_schema", "generate_query")
builder.add_conditional_edges(
    "generate_query",
    should_continue,
)
builder.add_edge("check_query", "run_query")
builder.add_edge("run_query", "generate_query")

agent = builder.compile(checkpointer=memory)

# question = "Which state has the highest sales?"

# for step in agent.stream(
#     {"messages": [{"role": "user", "content": question}]},
#     stream_mode="values",
# ):
#     step["messages"][-1].pretty_print()