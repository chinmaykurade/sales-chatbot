
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

from nodes import (intent_detection, 
                   generate_query,
                   data_extraction_agent,
                   validate_and_answer,
                   State)

load_dotenv()

memory = MemorySaver()


builder = StateGraph(State)
builder.add_node("intent_detection", intent_detection)
builder.add_node("generate_query", generate_query)
builder.add_node("data_extraction", data_extraction_agent)
builder.add_node("validate", validate_and_answer)
# builder.add_node("model", model)


builder.add_edge(START, "intent_detection")
# builder.add_conditional_edges("intent_detection", intent_router)
builder.add_edge("intent_detection", "generate_query")
builder.add_edge("generate_query", "data_extraction")
builder.add_edge("data_extraction", "validate")
builder.add_edge("validate", END)


agent = builder.compile(checkpointer=memory)

# question = "Which state has the highest sales?"

# for step in agent.stream(
#     {"messages": [{"role": "user", "content": question}]},
#     stream_mode="values",
# ):
#     step["messages"][-1].pretty_print()