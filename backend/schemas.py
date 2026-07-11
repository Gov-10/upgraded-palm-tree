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

class VoucherSchema(BaseModel):
    voucher_type: str
    date: str
    voucher_no: str
    party: str
    amount: float
    gst_amount: float
    status: str

class VoucherExtractionSchema(BaseModel):
    voucher_type: str = Field(description='The type of voucher being created Sales/Purchase/Payment/Receipt/Journal.')
    date: str = Field(description='The date the mentioned in the invoice.')
    voucher_no: str = Field(description='Create a new voucher number according to the format "VCH-yyyymmdd-hhnnss" where "y" is for year, "m" is for month and "d" is for day, "hhnnss" is the time stamp in 24hr format.')
    party: str = Field(description='The name of the party (person or entity) recieving the payment.')
    amount: float = Field(description='The net amount shown on the bill exclusive of GST.')
    gst_amount: float = Field(description='The net GST amount shown on the bill inclusive of all types of GST.')
    status: str = Field(description='Status of the bill will always be "Pending" by default.')

class VoucherReportList(BaseModel):
    reports: List[VoucherExtractionSchema]

class BankStatementSchema(BaseModel):
    bank_name: str = Field(description='Name of the bank mentioned in the transaction.')
    account_number: str = Field(description='Account number from/to which the transaction was made in the format "xxxxxxxx####" and replace only the # with the last 4 digits of the account number.')
    referrence_no: str = Field(description='The transaction id/ UPI transaction id/ cheque number/ transaction id/ referrence number etc mentioned in the transaction.')
    transaction_date: str = Field(description='The date of transaction mentioned in the transaction.')
    description: str = Field(description='A small note about any of the details of the transaction.')
    transaction_type: str = Field(description='The type of transaction, wether Credit or Debit.')
    amount: float = Field(description='The amount of money in the transaction.')

class BankStatementReportList(BaseModel):
    reports: List[BankStatementSchema]

class BankStatementInputSchema(BaseModel):
    bank_name: str
    account_number: str
    referrence_no: str
    transaction_date: str
    description: str
    transaction_type: str
    amount: float
    category: Optional[str] = 'Miscellaneous'
    reconciliation_status: Optional[str] = 'pending'
    party_name: Optional[str] = None
    voucher_ref: Optional[str] = None

class BRSInputSchema(BaseModel):
    transaction_id: int
    voucher_no: str
    description: str
    amount: float
    gst_amount: float

