from fastapi import FastAPI, HTTPException, Depends, Response
from sqlalchemy.orm import Session
import os, boto3, hashlib
from datetime import datetime, timedelta
from utils.otp_gen import otp_generator
from utils.send_email import email_send
from dotenv import load_dotenv
from schemas import InputSchema,ExtractSchema
from database import Users, sessionLocal, SessionTokens
load_dotenv()
from utils.agent import lang_app
from utils.extractor import extract, extract_ocr, extract_csv, hash_text
import uuid
from redis import Redis
from argon2 import PasswordHasher
ph = PasswordHasher()
s3= boto3.client('s3', region_name=os.getenv("S3_REGION"), aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"), aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"))
app=FastAPI()
redis_client=Redis(host=os.getenv("REDIS_HOST"), port=int(os.getenv("REDIS_PORT")), password=os.getenv("REDIS_PASSWORD"), decode_responses=True)
bucket=os.getenv("S3_BUCKET_NAME")
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
    user=db.query(Users).filter(Users.email==email).first()
    user.isactive=True
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="database error")
    db.refresh(user)
    redis_client.delete(key)
    return {"message": "email verified. Proceed to login"}

@app.post("/login")
def logi(payload: LoginSchema, db:Session=Depends(get_db), response: Response):
    username, password=payload.username, payload.password
    user=db.query(Users).filter(Users.username==username).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    if user.isactive == True:
        passw= user.password
        try:
            ph.verify(passw, password)
            pay= {"iss": "auth-service", "sub": username, "exp": }
            token=jwt.encode(pay, os.getenv("SECRET"), algorithms=["HS256"])
            response.set_cookie(key="session_token", value=token, httponly=True, secure=True, samesite="lax", max_age=604800)
            db_no=SessionTokens(username=username, token_hash=hashlib.sha256(token.encode()).hexdigest(), expires_at=datetime.utcnow()+timedelta(days=7), revoked=False)
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
    result = lang_app.invoke({"content": combined_text})
    text_hash = hash_text(combined_text) #isko caching mein use karenge
    return {"csv_file": result["fin"], "normal": result["normal"]}



