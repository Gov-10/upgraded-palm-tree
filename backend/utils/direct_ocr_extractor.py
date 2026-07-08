from google import genai
from google.genai import types
from schemas import VoucherReportList, BankStatementReportList

def ocr_extraction(file_bytes, content_type, schema):
    client = genai.Client()
    if schema == 'voucher':
        output_schema = VoucherReportList.model_json_schema()
    elif schema == 'bankStatement':
        output_schema = BankStatementReportList.model_json_schema()
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
                    response_json_schema=output_schema,
                    temperature=0.1
        )
    )
    return response