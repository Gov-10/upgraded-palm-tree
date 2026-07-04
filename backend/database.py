from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
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

class History(Base):
    __tablename__ = "histories"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String)
    input_file = Column(String, unique=True)
    output_file = Column(String, unique=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    
Base.metadata.create_all(bind=engine)
