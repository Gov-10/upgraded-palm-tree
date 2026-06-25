from pydantic import BaseModel, Field
from typing import Optional, List
class InputSchema(BaseModel):
    file_name: str
    content_type: Optional[str] = Field(description="pdf")

class ExtractSchema(BaseModel):
    file_type:List[Optional[str]] = Field(description="pdf")
    file_keys:List[str]

class CreateSchema(BaseModel):
    email:str
    username:str
    password:str

class EmailSchema(BaseModel):
    otp:str
    email: str

class LoginSchema(BaseModel):
    username:str
    password: str

