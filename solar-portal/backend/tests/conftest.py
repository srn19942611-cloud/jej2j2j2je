import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://solarportal:solarportal@localhost:5432/solarportal_test")

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db import models  # noqa: F401 - populates Base.metadata

TEST_DATABASE_URL = os.environ["DATABASE_URL"]


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DATABASE_URL, future=True)
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db(engine):
    # Agents call db.commit() internally, so a single shared-connection rollback-based
    # transaction (the usual pytest/SQLAlchemy isolation pattern) doesn't work here without
    # SAVEPOINT gymnastics. Simpler for this test suite: fresh Session per test, truncate
    # everything afterwards.
    SessionLocal = sessionmaker(bind=engine, future=True)
    session = SessionLocal()
    yield session
    session.close()
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f'TRUNCATE TABLE "{table.name}" CASCADE'))
