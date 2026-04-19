from pydantic import BaseModel
from typing import Optional
class InputSchema(BaseModel):
    file_name:str
    file_type:Optional[str]="pdf"

