from fastapi import FastAPI, HTTPException, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os, boto3, hashlib
from datetime import datetime, timedelta
from utils.otp_gen import otp_generator
from utils.send_email import email_send
from dotenv import load_dotenv
from schemas import InputSchema, ExtractSchema, CreateSchema, EmailSchema, LoginSchema
from database import Users, sessionLocal, SessionTokens
from botocore.config import Config
import jwt
import mimetypes
load_dotenv()
from utils.agent import lang_app, State
from utils.extractor import extract, extract_ocr, extract_csv, hash_text
import uuid
from redis import Redis
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from typing import Any, List
from utils.direct_ocr_extractor import ocr_extraction
from botocore.exceptions import ClientError
from schemas import VoucherSchema, BankStatementInputSchema, BRSInputSchema
from database import Vouchers, BankStatements, BRS

ph = PasswordHasher()
s3= boto3.client('s3', region_name=os.getenv("S3_REGION"), aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"), aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"), config=Config(signature_version="s3v4", s3={'addressing_style': 'virtual'}))
app=FastAPI()
redis_client=Redis(
    host=os.getenv("REDIS_HOST", 'comparison-hyperspeedy-canvas-69712.db.redis.io'),
    port=int(os.getenv("REDIS_PORT", 13818)),
    password=os.getenv("REDIS_PASSWORD"),
    decode_responses=True
)
binary_redis_client=Redis(
    host=os.getenv("REDIS_HOST", 'comparison-hyperspeedy-canvas-69712.db.redis.io'),
    port=int(os.getenv("REDIS_PORT", 6379)),
    password=os.getenv("REDIS_PASSWORD"),
)
bucket=os.getenv("S3_BUCKET_NAME")

origins = ['http://localhost:5503', 'http://127.0.0.1:5501', 'http://127.0.0.1:5502', 'http://127.0.0.1', '0.0.0.0']

app.add_middleware(CORSMiddleware,
                   allow_origins = ["*"],
                   allow_credentials = True,
                   allow_methods = ['*'],
                   allow_headers = ['*'])

def get_db():
    db=sessionLocal()
    try:
        yield db 
    finally:
        db.close()


@app.get("/")
def chek():
    return {"status": "Running"}

@app.post("/create")
def crea(payload: CreateSchema, db: Session=Depends(get_db)):
    email, username=payload.email, payload.username
    password=ph.hash(payload.password)
    db_note=Users(email=email, username=username, password=password, isactive=False)
    db.add(db_note)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"error: {str(e)}")
    db.refresh(db_note)
    otp= otp_generator()
    hashed= hashlib.sha256(otp.encode()).hexdigest()
    redis_client.setex(f"otp:{email}", 600, hashed)
    email_send(email, otp)
    return {"message": "OTP sent to your email"}

@app.post("/verify")
def veri(payload: EmailSchema, db:Session=Depends(get_db)):
    ot, email=payload.otp, payload.email
    key= f"otp:{email}"
    stored=redis_client.get(key)
    if not stored:
        raise HTTPException(status_code=404, detail="invalid otp or expired otp")
    input_hash=hashlib.sha256(ot.encode()).hexdigest()
    if input_hash != stored:
        raise HTTPException(status_code=401, detail="otp does not match")
    user = db.query(Users).filter(Users.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    user.isactive = True
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="database error")
    db.refresh(user)
    redis_client.delete(key)
    return {"message": "email verified. Proceed to login"}

@app.post("/login")
def logi(payload: LoginSchema, response: Response, db:Session=Depends(get_db)):
    username, password=payload.username, payload.password
    user = db.query(Users).filter(Users.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    if user.isactive:
        passw = user.password
        try:
            ph.verify(passw, password)
            secret = os.getenv("SECRET")
            if not secret:
                raise HTTPException(status_code=500, detail="JWT secret not configured")
            pay = {
                "iss": "auth-service",
                "sub": username,
                "exp": datetime.utcnow() + timedelta(days=7)
            }
            token = jwt.encode(pay, secret, algorithm="HS256")
            response.set_cookie(key="session_token", value=token, httponly=True, secure=True, samesite="lax", max_age=604800)
            db_no = SessionTokens(username=username, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=datetime.utcnow()+timedelta(days=7), revoked=False)
            db.add(db_no)
            try:
                db.commit()
            except Exception as e:
                db.rollback()
                raise HTTPException(status_code=500, detail="database error")
            db.refresh(db_no)
            return {"message": "login success"}
        except VerifyMismatchError:
            raise HTTPException(status_code=401, detail="passwords do not match")
    else:
        raise HTTPException(status_code=401, detail="verify your email")
           
@app.post("/upload")
def upl(payload: InputSchema):
    file_id=str(uuid.uuid4())
    key=f"docs/{file_id}-{payload.file_name}"
    pres=s3.generate_presigned_url(
        ClientMethod = 'put_object', 
        Params = {
            'Bucket': bucket, 
            "Key" : key, 
            "ContentType": payload.content_type
        }, 
        ExpiresIn = 600
    )
    status="uploaded"
    return {"upload_url": pres, "file_key": key, "status": status}

@app.post("/extract")
def extr(payload: ExtractSchema):
    key = None
    combined_text= ""
    for file_key in payload.file_keys:
        response = s3.get_object(
            Bucket=bucket,
            Key=file_key
        )
        file_bytes = response["Body"].read()
        text = extract(file_bytes)
        if len(text.strip()) < 100:
            text = extract_ocr(file_bytes)
        combined_text += "\n\n" + text
    dt = redis_client.get(key1)
    if dt["text"] == hash_text(combined_text):
        return {"normal": dt["ai_result"]}
    result = lang_app.invoke(State(content=combined_text))
    text_hash = hash_text(combined_text) #isko caching mein use karenge
    redis_client.setex(key, {"text": text_hash, "ai_result": result["normal"]}, 86400)
    return {"csv_file": result["fin"], "normal": result["normal"]}


@app.post("/extract-OCR")
async def extractOCR(request: Request):
    content_type = request.headers.get("Content-Type")
    schema = request.headers.get("Schema")
    allowed_types = ["application/pdf", "image/jpeg", "image/png"]
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")
    file_bytes = await request.body()
    binary_redis_client.set('cached_file', file_bytes, ex=600)
    redis_client.set('cached_file_type', content_type, ex=600)
    return ocr_extraction(file_bytes, content_type, schema)

@app.post("/upload-to-AWS")
async def upload_to_AWS(request: Request):
    content_type = redis_client.get('cached_file_type')
    schema = request.headers.get("Schema")
    allowed_types = ["application/pdf", "image/jpeg", "image/png"]
    ext = [".pdf", ".jpg", ".png"]
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")
    file_bytes = binary_redis_client.get('cached_file')
    file_name = str(uuid.uuid4())
    redis_client.set("file_key", f'{file_name}{ext[allowed_types.index(content_type)]}', ex=600)
    prefix = "bank_statements" if schema == "bankStatement" else "vouchers"
    try:
        response = s3.put_object(
            Bucket=bucket,
            Key=f'{prefix}/{file_name}{ext[allowed_types.index(content_type)]}',
            Body=file_bytes,                  # Pass the byte array directly here
            ContentType=content_type
            )
        
        status_code = response['ResponseMetadata']['HTTPStatusCode']
    
        if status_code == 200:
            print("Upload successful!")
            print(f"File ETag (MD5 Hash): {response['ETag']}")
        else:
            print(f"Upload failed with status code: {status_code}")
    except ClientError as e:
        # Catches AWS-specific errors (Access Denied, Bucket Not Found, etc.)
        print(f"AWS Error: {e.response['Error']['Message']}")
    except Exception as e:
        # Catches network timeouts or system errors
        print(f"An unexpected error occurred: {e}")

@app.post("/add-voucher")
def add_voucher(payload: List[VoucherSchema], db: Session = Depends(get_db)):
    file_key = redis_client.get("file_key")
    vouchers_added = []
    for item in payload:
        voucher = Vouchers(
            voucher_type=item.voucher_type,
            date=item.date,
            voucher_no=item.voucher_no,
            party=item.party,
            amount=item.amount,
            gst_amount=item.gst_amount,
            status=item.status,
            file_key=file_key
        )
        db.add(voucher)
        vouchers_added.append(voucher)
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    for v in vouchers_added:
        db.refresh(v)
        
    return [
        {
            "id": v.id,
            "voucher_type": v.voucher_type,
            "date": v.date,
            "voucher_no": v.voucher_no,
            "party": v.party,
            "amount": v.amount,
            "gst_amount": v.gst_amount,
            "status": v.status
        }
        for v in vouchers_added
    ]

@app.get("/vouchers")
def get_vouchers(db: Session = Depends(get_db)):
    rows = db.query(Vouchers).order_by(Vouchers.id.desc()).all()
    return [
        {
            "id": v.id,
            "voucher_type": v.voucher_type,
            "date": v.date,
            "voucher_no": v.voucher_no,
            "party": v.party,
            "amount": v.amount,
            "gst_amount": v.gst_amount,
            "status": v.status
        }
        for v in rows
    ]

@app.put("/vouchers/{voucher_id}")
def update_voucher(voucher_id: int, payload: VoucherSchema, db: Session = Depends(get_db)):
    voucher = db.query(Vouchers).filter(Vouchers.id == voucher_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    voucher.voucher_type = payload.voucher_type
    voucher.date = payload.date
    voucher.voucher_no = payload.voucher_no
    voucher.party = payload.party
    voucher.amount = payload.amount
    voucher.gst_amount = payload.gst_amount
    voucher.status = payload.status
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    db.refresh(voucher)
    return {
        "id": voucher.id,
        "voucher_type": voucher.voucher_type,
        "date": voucher.date,
        "voucher_no": voucher.voucher_no,
        "party": voucher.party,
        "amount": voucher.amount,
        "gst_amount": voucher.gst_amount,
        "status": voucher.status
    }

@app.delete("/vouchers/{voucher_id}")
def delete_voucher(voucher_id: int, db: Session = Depends(get_db)):
    voucher = db.query(Vouchers).filter(Vouchers.id == voucher_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    try:
        db.delete(voucher)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return {"message": "Voucher deleted successfully"}

def _bs_to_dict(bs):
    return {
        "id": bs.id,
        "bank_name": bs.bank_name,
        "account_number": bs.account_number,
        "referrence_no": bs.referrence_no,
        "transaction_date": bs.transaction_date,
        "description": bs.description,
        "transaction_type": bs.transaction_type,
        "amount": bs.amount,
        "category": bs.category,
        "reconciliation_status": bs.reconciliation_status,
        "party_name": bs.party_name,
        "voucher_ref": bs.voucher_ref
    }

@app.post("/bank-statements")
def add_bank_statements(payload: List[BankStatementInputSchema], db: Session = Depends(get_db)):
    records_added = []
    for item in payload:
        bs = BankStatements(
            bank_name=item.bank_name,
            account_number=item.account_number,
            referrence_no=item.referrence_no,
            transaction_date=item.transaction_date,
            description=item.description,
            transaction_type=item.transaction_type,
            amount=item.amount,
            category=item.category,
            reconciliation_status=item.reconciliation_status,
            party_name=item.party_name,
            voucher_ref=item.voucher_ref
        )
        db.add(bs)
        records_added.append(bs)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    for r in records_added:
        db.refresh(r)
    return [_bs_to_dict(r) for r in records_added]

@app.get("/bank-statements")
def get_bank_statements(db: Session = Depends(get_db)):
    rows = db.query(BankStatements).order_by(BankStatements.id.desc()).all()
    return [_bs_to_dict(r) for r in rows]

@app.get("/bank-statements/{bs_id}")
def get_bank_statement(bs_id: int, db: Session = Depends(get_db)):
    bs = db.query(BankStatements).filter(BankStatements.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    return _bs_to_dict(bs)

@app.put("/bank-statements/{bs_id}")
def update_bank_statement(bs_id: int, payload: BankStatementInputSchema, db: Session = Depends(get_db)):
    bs = db.query(BankStatements).filter(BankStatements.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    bs.bank_name = payload.bank_name
    bs.account_number = payload.account_number
    bs.referrence_no = payload.referrence_no
    bs.transaction_date = payload.transaction_date
    bs.description = payload.description
    bs.transaction_type = payload.transaction_type
    bs.amount = payload.amount
    bs.category = payload.category or "Miscellaneous"
    bs.reconciliation_status = payload.reconciliation_status or "pending"
    bs.party_name = payload.party_name or ''
    bs.voucher_ref = payload.voucher_ref or ''
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    db.refresh(bs)
    return _bs_to_dict(bs)

@app.delete("/bank-statements/{bs_id}")
def delete_bank_statement(bs_id: int, db: Session = Depends(get_db)):
    bs = db.query(BankStatements).filter(BankStatements.id == bs_id).first()
    if not bs:
        raise HTTPException(status_code=404, detail="Bank statement not found")
    try:
        db.delete(bs)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return {"message": "Bank statement deleted successfully"}

def _brs_to_dict(b):
    return {
        "id": b.id,
        "transaction_id": b.transaction_id,
        "voucher_no": b.voucher_no,
        "description": b.description,
        "amount": b.amount,
        "gst_amount": b.gst_amount,
    }

@app.post("/BRS")
def add_BRS(payload: BRSInputSchema, db: Session = Depends(get_db)):
    brs = BRS(
        transaction_id=payload.transaction_id,
        voucher_no=payload.voucher_no,
        description=payload.description,
        amount=payload.amount,
        gst_amount=payload.gst_amount,
    )
    db.add(brs)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    db.refresh(brs)
    return _brs_to_dict(brs)

@app.get("/BRS")
def get_BRS(db: Session = Depends(get_db)):
    rows = db.query(BRS).order_by(BRS.id.desc()).all()
    return [_brs_to_dict(r) for r in rows]

@app.delete("/BRS/{brs_id}")
def delete_BRS(brs_id: int, db: Session = Depends(get_db)):
    brs = db.query(BRS).filter(BRS.id == brs_id).first()
    if not brs:
        raise HTTPException(status_code=404, detail="BRS record not found")
    bs_id     = brs.transaction_id
    voucher_no = brs.voucher_no
    try:
        db.delete(brs)
        # Revert bank statement to pending, clear party and voucher ref
        bs = db.query(BankStatements).filter(BankStatements.id == bs_id).first()
        if bs:
            bs.reconciliation_status = "pending"
            bs.party_name = ''
            bs.voucher_ref = ''
        # Revert voucher status to Pending
        vch = db.query(Vouchers).filter(Vouchers.voucher_no == voucher_no).first()
        if vch:
            vch.status = "Pending"
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return {"message": "BRS record deleted and related records reverted to pending"}