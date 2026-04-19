from pydantic import BaseModel
from typing import Optional
class InputSchema(BaseModel):
    file_name:str
    content_type:Optional[str]="pdf"

