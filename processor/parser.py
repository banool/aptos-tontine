import json
import typing
from dataclasses import dataclass

from aptos.transaction.testing1.v1 import transaction_pb2
from aptos.util.timestamp import timestamp_pb2
from table import TontineMembership

# INDEXER_NAME is used to track the latest processed version
INDEXER_NAME = "python_example_indexer"


@dataclass()
class TontineMembershipDeletion:
    tontine_address: str
    member_address: str


@dataclass()
class TontineMembershipUpdate:
    tontine_address: str
    member_address: str
    has_ever_contributed: bool


# Returns:
# - List of TontineMembership objects to add
# - List of TontineMembershipDeletions
def parse(
    transaction: transaction_pb2.Transaction,
    tontine_module_address: str,
    tontine_module_name: str,
) -> typing.Tuple[
    typing.List[TontineMembership],
    typing.List[TontineMembershipUpdate],
    typing.List[TontineMembershipDeletion],
]:
    additions = []
    updates = []
    deletions = []

    # Custom filtering
    # Here we filter out all transactions that are not of type TRANSACTION_TYPE_USER
    if transaction.type != transaction_pb2.Transaction.TRANSACTION_TYPE_USER:
        return ([], [], [])

    # Parse Transaction struct

    user_transaction = transaction.user
    for event in user_transaction.events:
        if event.type.struct.address != tontine_module_address:
            continue
        if event.type.struct.module != tontine_module_name:
            continue

        data = json.loads(event.data)

        if event.type.struct.name == "TontineCreatedEvent":
            additions.append(
                TontineMembership(
                    tontine_address=standardize_address(event.key.account_address),
                    member_address=standardize_address(data["creator"]),
                    is_creator=True,
                    has_ever_contributed=False,
                )
            )

        if event.type.struct.name == "MemberInvitedEvent":
            additions.append(
                TontineMembership(
                    tontine_address=standardize_address(event.key.account_address),
                    member_address=standardize_address(data["member"]),
                    is_creator=False,
                    has_ever_contributed=False,
                )
            )

        if event.type.struct.name == "MemberLeftEvent":
            deletions.append(
                TontineMembershipDeletion(
                    tontine_address=standardize_address(event.key.account_address),
                    member_address=standardize_address(data["member"]),
                )
            )

        if event.type.struct.name == "MemberContributedEvent":
            updates.append(
                TontineMembershipUpdate(
                    tontine_address=standardize_address(event.key.account_address),
                    member_address=standardize_address(data["member"]),
                    has_ever_contributed=True,
                )
            )

    return (additions, updates, deletions)


def parse_timestamp(timestamp: timestamp_pb2.Timestamp):
    datetime_obj = datetime.datetime.fromtimestamp(
        timestamp.seconds + timestamp.nanos * 1e-9
    )
    return datetime_obj.strftime("%Y-%m-%d %H:%M:%S.%f")


def standardize_address(address: str):
    if address.startswith("0x"):
        return address
    return "0x" + address
