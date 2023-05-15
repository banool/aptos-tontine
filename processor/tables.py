import argparse
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    String,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from config import Config


class Base(DeclarativeBase):
    pass


parser = argparse.ArgumentParser()
parser.add_argument("-c", "--config", help="Path to config file", required=True)
args = parser.parse_args()

config = Config.from_yaml_file(args.config)


# This table tracks tontine membership. Rows are unique based on the following:
# - Tontine. Defined by tontine address.
# - Member. There is one row per member.
class TontineMembership(Base):
    __tablename__ = "tontine_membership"

    tontine_address: Mapped[str] = mapped_column(String, primary_key=True)
    member_address: Mapped[str] = mapped_column(String, primary_key=True)
    is_creator: Mapped[bool] = mapped_column(Boolean, default=False)
    # True if the member has ever contributed to the tontine, even if they
    # withdrew or left later.
    has_ever_contributed: Mapped[bool] = mapped_column(Boolean, default=False)


# You'll notice there is no enum variant to represent the finished state. To represent
# this we instead delete the row.
class TontineStateEnum(Enum):
    STAGING = 0
    LOCKED = 1


# This table tracks basic tontine state. Since the purpose of the API in front of
# tables is to provide a way to look up tontine membership and display it in
# appropriate categories, this is a simplification of the states that a tontine
# can be in.
class TontineState(Base):
    __tablename__ = "tontine_state"

    tontine_address: Mapped[str] = mapped_column(String, primary_key=True)
    state: Mapped[int] = mapped_column(Integer)


class NextVersionToProcess(Base):
    __tablename__ = "next_versions_to_process"

    indexer_name: Mapped[str] = mapped_column(primary_key=True)
    next_version: Mapped[int] = mapped_column(BigInteger)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
    )


engine = create_engine(config.db_connection_uri)
Base.metadata.create_all(engine)
