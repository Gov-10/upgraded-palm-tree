from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv
load_dotenv()
DATABASE_URL=os.getenv("DATABASE_URL")
engine=create_engine(DATABASE_URL)
sessionLocal=sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base=declarative_base()
class Users(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email=Column(String, unique=True)
    username=Column(String, unique=True)
    password=Column(String)
    isactive=Column(Boolean, default=False)

class SessionTokens(Base):
    __tablename__ = "sessiontokens"
    id=Column(Integer, primary_key=True, index=True)
    username=Column(String)
    token_hash=Column(String)
    expires_at=Column(DateTime)
    revoked=Column(Boolean, default=False)
    
Base.metadata.create_all(bind=engine)
