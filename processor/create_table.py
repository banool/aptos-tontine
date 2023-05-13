from sqlalchemy import BigInteger, create_engine, DateTime, func, String
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from datetime import datetime
import argparse
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
    is_creator: Mapped[bool]


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
