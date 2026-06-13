from pydantic import BaseModel
from typing import Optional, List
class InputSchema(BaseModel):
    file_name:List[str]
    content_type:List[Optional[str]]="pdf"

class ExtractSchema(BaseModel):
    file_type:List[Optional[str]]="pdf"
    file_keys:List[str]
