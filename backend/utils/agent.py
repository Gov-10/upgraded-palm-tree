from langgraph.graph import StateGraph, END
from pydantic import BaseModel
from typing import Optional
from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os, json, uuid
import pandas as pd
from io import StringIO
from pydantic import SecretStr

load_dotenv()
llm=ChatGroq(model='qwen/qwen3-32b', temperature=0, max_tokens=None, reasoning_format="hidden", timeout=None, max_retries=2, api_key=SecretStr(os.getenv('GROQ_API_KEY', 'none')))
import boto3
s3 = boto3.client(
    "s3",
    region_name=os.getenv("S3_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)
bucket = os.getenv("S3_BUCKET_NAME")

class State(BaseModel):
    content:str
    normal: Optional[dict]=None
    fin: Optional[str]=""
    key: Optional[str]=""

SCHEMA= ""

def normal_node(state: State):
    prompt = f"""
           You are an invoice extraction system.
           Convert the invoice text into JSON. Return ONLY valid JSON.
           Schema:{SCHEMA}
           Invoice Text:{state.content}"""
    resp = llm.invoke(prompt)
    normal_data = resp.content
    if isinstance(normal_data, str):
        normal_data = json.loads(normal_data)
    return {"normal": normal_data}


def final_node(state:State):
    buffer = StringIO()
    data= state.normal
    if data is None:
        raise ValueError
    invoice_row = {
        "invoice_number": data.get("invoice_number"),
        "invoice_date": data.get("invoice_date"),
        "supplier_name": data["supplier"]["name"],
        "buyer_name": data["buyer"]["name"],
        "grand_total": data["totals"]["grand_total"]
    }
    filename = f"{uuid.uuid4()}.csv"
    s3_key = f"processed-csv/{filename}"
    pd.DataFrame([invoice_row]).to_csv(
        buffer,
        index=False
    )
    s3.put_object(
    Bucket=bucket,
    Key=s3_key,
    Body=buffer.getvalue(),
    ContentType="text/csv")

    presigned_url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": s3_key
        },
        ExpiresIn=3600
    )
    return {"fin": presigned_url, "key": s3_key}


graph=StateGraph(State)
graph.add_node("normal", normal_node)
graph.add_node("final", final_node)
graph.set_entry_point("normal")
graph.set_finish_point("final")
graph.add_edge("normal", "final")
graph.add_edge("final", END)
lang_app=graph.compile()


