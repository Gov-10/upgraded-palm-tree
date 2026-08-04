from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Float, null, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker, Mapped, mapped_column
from typing import List, Any, Dict, Optional
import os
from datetime import datetime
from dotenv import load_dotenv
from sympy import false
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL environment variable is required")
engine = create_engine(DATABASE_URL)
sessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Users(Base):
    __tablename__ = "test"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    username: Mapped[str] = mapped_column(String, unique=True)
    password: Mapped[str] = mapped_column(String)
    isactive: Mapped[bool] = mapped_column(Boolean, default=False)

class SessionTokens(Base):
    __tablename__ = "sessiontokens"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String)
    token_hash: Mapped[str] = mapped_column(String)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)

class Vouchers(Base):
    __tablename__ = "vouchers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    voucher_type: Mapped[str] = mapped_column(String)
    date: Mapped[str] = mapped_column(String)
    voucher_no: Mapped[str] = mapped_column(String, unique=True, index=True)
    party: Mapped[str] = mapped_column(String)
    items: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    amount: Mapped[float] = mapped_column(Float)
    gst_amount: Mapped[float] = mapped_column(Float)
    discount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="pending")
    file_key: Mapped[str] = mapped_column(String, nullable=True)
    # NEW — voucher type tag + arbitrary type-specific data store
    meta_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    meta: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)

class History(Base):
    __tablename__ = "histories"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String)
    input_file = Column(String, unique=True)
    output_file = Column(String, unique=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

class BankStatements(Base):
    __tablename__ = "bankStatements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bank_name: Mapped[str] = mapped_column(String)
    account_number: Mapped[str] = mapped_column(String)
    referrence_no: Mapped[str] = mapped_column(String)
    transaction_date: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    transaction_type: Mapped[str] = mapped_column(String)
    amount: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String)
    reconciliation_status: Mapped[str] = mapped_column(String, default='Pending')
    party_name: Mapped[str] = mapped_column(String, default=None)
    voucher_ref: Mapped[str] = mapped_column(String, unique=True, default=None)

class BRS(Base):
    __tablename__ = "BRS"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    transaction_id: Mapped[int] = mapped_column(String)
    voucher_no: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    amount: Mapped[float] = mapped_column(Float)
    gst_amount: Mapped[float] = mapped_column(Float)
    statement_amount: Mapped[float] = mapped_column(Float)
    
class godown(Base):
    __tablename__ = "godown"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    godown_name: Mapped[str] = mapped_column(String)
    location: Mapped[str] = mapped_column(String)
    items: Mapped[List[Dict[str,Any]]] = mapped_column(JSONB, nullable=false, default=list)

class units(Base):
    __tablename__ = "units"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    conversion: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=false, default=dict)
    decimals: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String)
    used: Mapped[int] = mapped_column(Integer)

class stock(Base):
    __tablename__ = "stock"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    item: Mapped[str] = mapped_column(String)
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String)
    rate: Mapped[float] = mapped_column(Float)
    godowns: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=false, default=dict)
    gst_rate: Mapped[float] = mapped_column(Float)
    hsn_code: Mapped[int] = mapped_column(Integer)

class notificationLogs(Base):
    __tablename__ = "notification_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    detail: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

Base.metadata.create_all(bind=engine)
