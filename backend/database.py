from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.orm import declarative_base, sessionmaker, Mapped, mapped_column
import os
from datetime import datetime
from dotenv import load_dotenv
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
    amount: Mapped[float] = mapped_column(Float)
    gst_amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="pending")
    file_key: Mapped[str] = mapped_column(String, unique=True)

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
    
Base.metadata.create_all(bind=engine)
