# lecturesproject/services/user_service.py

from sqlalchemy.orm import Session
from lecturesproject.models import User
from lecturesproject.schemas import UserCreate
from lecturesproject.utils import hash_password


def create_user(user_data: UserCreate, db: Session) -> User:
    existing_user = db.query(User).filter(
        (User.username == user_data.username) |
        (User.email == user_data.email)
    ).first()

    if existing_user:
        raise ValueError("Username or email already exists")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
