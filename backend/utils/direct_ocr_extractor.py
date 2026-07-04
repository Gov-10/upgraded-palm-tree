from google import genai
from pydantic import BaseModel, Field
from typing import List, Any
from google.genai import types

class ExtractionSchema(BaseModel):
    voucher_type: str = Field(description='The type of voucher being created Sales/Purchase/Payment/Receipt/Journal.')
    date: str = Field(description='The date the mentioned in the invoice.')
    voucher_no: str = Field(description='Create a new voucher number according to the format "VCH-hhmmss" where h is for hour, m is for minutes and s is for the seconds.')
    party: str = Field(description='The name of the party (person or entity) recieving the payment.')
    amount: float = Field(description='The net amount shown on the bill exclusive of GST.')
    gst_amount: float = Field(description='The net GST amount shown on the bill inclusive of all types of GST.')
    status: str = Field(description='Status of the bill will always be "Pending" by default.')

class ReportList(BaseModel):
    reports: List[ExtractionSchema]

def ocr_extraction(file_bytes, content_type):
    client = genai.Client()
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part(
                inline_data=types.Blob(
                    mime_type=content_type,
                    data=file_bytes
                )
            ),
            'Analyse the file and extract the text required according to the output schema and for any field where you are confused or can\'t find the correct data write NA or 0'
        ],
        config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=ReportList.model_json_schema(),
                    temperature=0.1
        )
    )
    return response