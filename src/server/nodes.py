from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage, AIMessage
from langgraph.graph import END, START, StateGraph
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langgraph.prebuilt import ToolNode
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
import os
from typing import Literal


from prompts import (generate_query_system_prompt, 
                     check_query_system_prompt, 
                     data_extraction_system_prompt,
                     validation_and_answer_system_prompt,
                     summarize_prompt)

llm = ChatOpenAI(model="gpt-5.1")


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://appuser:secret@postgres:5432/app"
)

db = SQLDatabase.from_uri(DATABASE_URL)

print(f"Dialect: {db.dialect}")
print(f"Available tables: {db.get_usable_table_names()}")


toolkit = SQLDatabaseToolkit(db=db, llm=llm)

tools = toolkit.get_tools()

list_tables_tool = next(tool for tool in tools if tool.name == "sql_db_list_tables")

get_schema_tool = next(tool for tool in tools if tool.name == "sql_db_schema")
get_schema_node = ToolNode([get_schema_tool], name="get_schema")

run_query_tool = next(tool for tool in tools if tool.name == "sql_db_query")
run_query_node = ToolNode([run_query_tool], name="run_query")

for tool in tools:
    print(f"{tool.name}: {tool.description}\n")

class State(TypedDict):
    messages: Annotated[list, add_messages]
    intent: Optional[str]


async def intent_detection(state: State):
    last_message = state["messages"][-1]
    last_message_content = last_message.content
    
    intent = "qna"
    if "summarize" in last_message_content.lower():
        new_message = HumanMessage(summarize_prompt.format(
            additional_user_query=last_message_content
        ))
        intent = "summarize"
    else:
        new_message = AIMessage("Routing to conversation Q&A workflow.")
        
    return {
        "messages": [new_message],
        "intent": intent
    }
    
# async def intent_router(state: State):
#     if state["intent"] == "summarize":
#         return "model"
#     return "list_tables"



def list_tables(state: State):
    tool_call = {
        "name": "sql_db_list_tables",
        "args": {},
        "id": "abc123",
        "type": "tool_call",
    }
    tool_call_message = AIMessage(content="", tool_calls=[tool_call])

    list_tables_tool = next(tool for tool in tools if tool.name == "sql_db_list_tables")
    tool_message = list_tables_tool.invoke(tool_call)
    response = AIMessage(f"Available tables: {tool_message.content}")

    return {"messages": [tool_call_message, tool_message, response]}


def call_get_schema(state: State):
    # Note that LangChain enforces that all models accept `tool_choice="any"`
    # as well as `tool_choice=<string name of tool>`.
    llm_with_tools = llm.bind_tools([get_schema_tool], tool_choice="any")
    response = llm_with_tools.invoke(state["messages"])

    return {"messages": [response]}


def generate_query(state: State):
    system_message = generate_query_system_prompt.format(
                    dialect=db.dialect,
                    top_k=5,)
    # We do not force a tool call here, to allow the model to
    # respond naturally when it obtains the solution.
    agent = create_agent("gpt-5", 
                         tools=[run_query_tool],
                         system_prompt=system_message)
    response = agent.invoke({"messages": state["messages"]})

    return {"messages": [response]}


def data_extraction_agent(state: State):
    system_message = data_extraction_system_prompt.format(
                    dialect=db.dialect,
                    top_k=5,
                )
    agent = create_agent("gpt-5", 
                         tools=[run_query_tool],
                         system_prompt=system_message)
    # We do not force a tool call here, to allow the model to
    # respond naturally when it obtains the solution.
    response = agent.invoke({"messages": state["messages"]})

    return {"messages": [response]}


def validate_and_answer(state: State):
    system_message = validation_and_answer_system_prompt
    # We do not force a tool call here, to allow the model to
    # respond naturally when it obtains the solution.
    agent = create_agent("gpt-5", 
                         system_prompt=system_message)
    # We do not force a tool call here, to allow the model to
    # respond naturally when it obtains the solution.
    response = agent.invoke({"messages": state["messages"]})

    return {"messages": [response]}


# def check_query(state: State):
#     system_message = {
#         "role": "system",
#         "content": check_query_system_prompt.format(dialect=db.dialect),
#     }

#     # Generate an artificial user message to check
#     tool_call = state["messages"][-1].tool_calls[0]
#     user_message = {"role": "user", "content": tool_call["args"]["query"]}
#     llm_with_tools = llm.bind_tools([run_query_tool], tool_choice="any")
#     response = llm_with_tools.invoke([system_message, user_message])
#     response.id = state["messages"][-1].id

#     return {"messages": [response]}


# def should_continue(state: State) -> Literal[END, "check_query"]:
#     messages = state["messages"]
#     last_message = messages[-1]
#     if not last_message.tool_calls:
#         return "data_extraction"
#     else:
#         return "check_query"
    
    
async def model(state: State):
    result = await llm.ainvoke(state["messages"])
    return {
        "messages": [result], 
    }