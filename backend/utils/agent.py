from langgraph.graph import StateGraph, END
from pydantic import BaseModel
from typing import Optional
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os
load_dotenv()
llm=ChatGroq(model='qwen/qwen3-32b', temperature=0, max_tokens=None, reasoning_format="hidden", timeout=None, max_retries=2)

class State(BaseModel):
    content:str
    normal: Optional[str]=""
    fin: Optional[str]=""

def normal_node(state: State):
    pass

def final_node(state:State):
    pass

graph=StateGraph(State)
graph.add_node("normal", normal_node)
graph.add_node("final", final_node)
graph.set_entry_point("normal")
graph.set_finish_point("final")
graph.add_edge("normal", "final")
graph.add_edge("final", END)
lang_app=graph.compile()


