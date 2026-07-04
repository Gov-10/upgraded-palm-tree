from langgraph.graph import StateGraph, END
from pydantic import BaseModel, SecretStr
from typing import Optional
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os
import json
import uuid
import pandas as pd
from io import StringIO
import boto3
load_dotenv()
llm = ChatGroq(
    model="qwen/qwen3-32b",
    temperature=0,
    max_tokens=None,
    reasoning_format="hidden",
    timeout=None,
    max_retries=2,
    api_key=SecretStr(os.getenv("GROQ_API_KEY", "none"))
)
s3 = boto3.client(
    "s3",
    region_name=os.getenv("S3_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)
bucket = os.getenv("S3_BUCKET_NAME")
class State(BaseModel):
    content: str
    normal: Optional[dict] = None
    fin: Optional[str] = ""
    key: Optional[str] = ""
SCHEMA = """
{
  "invoice_number": "",
  "invoice_date": "",
  "supplier": {
    "name": ""
  },
  "buyer": {
    "name": ""
  },
  "totals": {
    "grand_total": ""
  },
  "receiver_name": "",
  "place_of_supply": "",
  "supply_type": "",
}
"""


def clean_json_response(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[len("```json"):]
    if text.startswith("```"):
        text = text[len("```"):]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return text

def normal_node(state: State):
    prompt = f"""
You are an invoice extraction system.
Extract invoice information and return ONLY VALID JSON.
Schema:
{SCHEMA}
Invoice Text:
{state.content}
If any field has missing data, assign 'NA' to that field ONLY
"""

    resp = llm.invoke(prompt)
    content = resp.content
    print("LLM Output bhaiyya....->")
    print(repr(content))
    print()
    if not isinstance(content, str):
        content = str(content)

    cleaned = clean_json_response(content)
    try:
        normal_data = json.loads(cleaned)
    except Exception as e:
        print("JSON failed ji...")
        print(cleaned)
        print()
        raise ValueError(f"Invalid JSON returned by LLM: {str(e)}")
    return {"normal": normal_data}


def final_node(state: State):
    data = state.normal

    if data is None:
        raise ValueError("No extracted invoice data found")

    invoice_row = {
        "invoice_number": data.get("invoice_number"),
        "invoice_date": data.get("invoice_date"),
        "supplier_name": data.get("supplier", {}).get("name"),
        "buyer_name": data.get("buyer", {}).get("name"),
        "grand_total": data.get("totals", {}).get("grand_total")
    }

    buffer = StringIO()

    pd.DataFrame([invoice_row]).to_csv(
        buffer,
        index=False
    )

    filename = f"{uuid.uuid4()}.csv"
    s3_key = f"processed-csv/{filename}"

    s3.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=buffer.getvalue(),
        ContentType="text/csv"
    )

    presigned_url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": s3_key
        },
        ExpiresIn=3600
    )

    return {
        "fin": presigned_url,
        "key": s3_key
    }


graph = StateGraph(State)

graph.add_node("normal", normal_node)
graph.add_node("final", final_node)

graph.set_entry_point("normal")

graph.add_edge("normal", "final")
graph.add_edge("final", END)

lang_app = graph.compile()
