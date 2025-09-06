from pydantic import BaseModel, EmailStr
from enum import Enum

class RoleEnum(str, Enum):
    lecturer = "lecturer"

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.lecturer
    full_name: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
