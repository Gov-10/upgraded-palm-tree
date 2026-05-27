from fastapi import FastAPI
import os, boto3
from dotenv import load_dotenv
from schemas import InputSchema
load_dotenv()
from utils.extractor import extract, extract_ocr, extract_csv, hash_text
import uuid
s3= boto3.client('s3', region_name=os.getenv("S3_REGION"), aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"), aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"))
bucket=os.getenv("S3_BUCKET_NAME")

app=FastAPI()
@app.post("/upload")
def upl(payload: InputSchema):
    file_id=str(uuid.uuid4())
    key=f"docs/{file_id}-{payload.file_name}"
    pres=s3.generate_presigned_url(
        ClientMethod = 'put_object', 
        Params = {
            'Bucket': bucket_name, 
            "Key" : key, 
            "ContentType": payload.content_type
        }, 
        ExpiresIn = 600
    )
    return {"upload_url": pres, "file_key": key}

@app.post("/extract")
def extr(payload: ExtractSchema):
    file_key= payload.file_key
    response= s3.get_object(Bucket=bucket, key=file_key)
    file_bytes=response["Body"].read()
    text= extract(response)
    if len(text.strip())< 100:
        text = extract_ocr(text)
    #TODO: CSV Parsing code
    text_hash=hash_text(text)
    return {"hashed_text": text_hash}
