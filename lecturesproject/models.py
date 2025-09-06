from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# -------------------- Student Table --------------------
class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    lecturer_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 🔑 Link to lecturer
    student_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    university = Column(String, nullable=False)
    module = Column(String, nullable=False)
    class_type = Column(String, nullable=False)

# -------------------- StudentScore Table --------------------
class StudentScore(Base):
    __tablename__ = "student_scores"

    id = Column(Integer, primary_key=True, index=True)
    lecturer_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 🔑 Link to lecturer
    student_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    university = Column(String, nullable=False)
    module = Column(String, nullable=False)
    class_type = Column(String, nullable=False)
    mark = Column(Float, nullable=False)

# -------------------- User Table --------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="lecturer")
    full_name = Column(String)
    is_active = Column(Boolean, default=True)

  
class PasswordResetCode(Base):
    __tablename__ = "password_reset_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(Integer, nullable=False)  # store as Unix timestamp
  
