import json
import typing
from dataclasses import dataclass

from aptos_indexer_protos.aptos.transaction.v1 import transaction_pb2
from aptos_indexer_protos.aptos.util.timestamp import timestamp_pb2
from tables import TontineMembership, TontineState, TontineStateEnum

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


@dataclass
class TontineStateUpdate:
    tontine_address: str
    state: int


# This function parses transactions and outputs create, update, and delete operations
# for both the TontineMembership and TontineState tables. If the tontine is deleted
# it outputs a delete operation for everything related to that tontine.
def parse(
    transaction: transaction_pb2.Transaction,
    tontine_module_address: str,
    tontine_module_name: str,
) -> typing.Tuple[
    typing.List[TontineMembership],
    typing.List[TontineMembershipUpdate],
    typing.List[TontineMembershipDeletion],
    typing.List[TontineState],
    typing.List[TontineStateUpdate],
    typing.List[str],
    typing.List[str],
]:
    membership_additions = []
    membership_updates = []
    membership_deletions = []

    state_additions = []
    state_updates = []
    state_deletions = []

    total_tontine_deletions = []

    # Custom filtering
    # Here we filter out all transactions that are not of type TRANSACTION_TYPE_USER
    if transaction.type != transaction_pb2.Transaction.TRANSACTION_TYPE_USER:
        return ([], [], [], [], [], [], [])

    user_transaction = transaction.user
    for event in user_transaction.events:
        if event.type.struct.address != tontine_module_address:
            continue
        if event.type.struct.module != tontine_module_name:
            continue

        data = json.loads(event.data)

        tontine_address = standardize_address(event.key.account_address)

        if event.type.struct.name == "TontineCreatedEvent":
            membership_additions.append(
                TontineMembership(
                    tontine_address=tontine_address,
                    member_address=standardize_address(data["creator"]),
                    is_creator=True,
                    has_ever_contributed=False,
                )
            )
            state_additions.append(
                TontineState(
                    tontine_address=tontine_address,
                    state=TontineStateEnum.STAGING.value,
                )
            )

        if event.type.struct.name == "TontineLockedEvent":
            state_updates.append(
                TontineStateUpdate(
                    tontine_address=tontine_address,
                    state=TontineStateEnum.LOCKED.value,
                )
            )

        if event.type.struct.name == "MemberInvitedEvent":
            membership_additions.append(
                TontineMembership(
                    tontine_address=tontine_address,
                    member_address=standardize_address(data["member"]),
                    is_creator=False,
                    has_ever_contributed=False,
                )
            )

        if event.type.struct.name == "MemberContributedEvent":
            membership_updates.append(
                TontineMembershipUpdate(
                    tontine_address=tontine_address,
                    member_address=standardize_address(data["member"]),
                    has_ever_contributed=True,
                )
            )

        if event.type.struct.name == "MemberLeftEvent":
            membership_deletions.append(
                TontineMembershipDeletion(
                    tontine_address=tontine_address,
                    member_address=standardize_address(data["member"]),
                )
            )

        if (
            event.type.struct.name == "FundsClaimedEvent"
            or event.type.struct.name == "FallbackExecutedEvent"
        ):
            state_deletions.append(tontine_address)

    # Look for tontine deletions.
    if (
        user_transaction.request.payload.entry_function_payload.entry_function_id_str
        == f"{tontine_module_address}::{tontine_module_name}::destroy"
    ):
        data = json.loads(
            user_transaction.request.payload.entry_function_payload.arguments[0]
        )
        total_tontine_deletions.append(standardize_address(data["inner"]))

    return (
        membership_additions,
        membership_updates,
        membership_deletions,
        state_additions,
        state_updates,
        state_deletions,
        total_tontine_deletions,
    )


def standardize_address(address: str):
    if address.startswith("0x"):
        return address
    return "0x" + address
