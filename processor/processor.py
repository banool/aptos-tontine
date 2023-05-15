import json
import logging
import os
from parser import INDEXER_NAME, parse

import grpc
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from aptos.indexer.v1 import raw_data_pb2, raw_data_pb2_grpc
from config import Config
from table import NextVersionToProcess, TontineMembership


def run_processor(config: Config):
    logging.info(f"Running processor at pid {os.getpid()}...")

    engine = create_engine(config.db_connection_uri)

    metadata = (
        ("x-aptos-data-authorization", config.indexer_api_key),
        ("x-aptos-request-name", INDEXER_NAME),
    )
    options = [("grpc.max_receive_message_length", -1)]

    if config.starting_version_override != None:
        starting_version = config.starting_version_override
    else:
        # Start from next version to process in db
        with Session(engine) as session, session.begin():
            next_version_to_process_from_db = session.get(
                NextVersionToProcess, INDEXER_NAME
            )
            if next_version_to_process_from_db != None:
                starting_version = next_version_to_process_from_db.next_version
            elif config.starting_version != None:
                starting_version = config.starting_version
            else:
                starting_version = 0

    logging.info(
        json.dumps(
            {
                "message": "Connected to the indexer grpc",
                "starting_version": starting_version,
            }
        )
    )
    # Connect to grpc
    with grpc.insecure_channel(config.indexer_endpoint, options=options) as channel:
        stub = raw_data_pb2_grpc.RawDataStub(channel)
        current_transaction_version = starting_version

        for response in stub.GetTransactions(
            raw_data_pb2.GetTransactionsRequest(starting_version=starting_version),
            metadata=metadata,
        ):
            chain_id = response.chain_id

            if chain_id != config.chain_id:
                raise Exception(
                    "Chain ID mismatch. Expected chain ID is: "
                    + str(config.chain_id)
                    + ", but received chain ID is: "
                    + str(chain_id)
                )
            logging.info(
                json.dumps(
                    {
                        "message": "Response received",
                        "starting_version": response.transactions[0].version,
                    }
                )
            )
            transactions_output = response
            for transaction in transactions_output.transactions:
                transaction_version = transaction.version
                if transaction_version != current_transaction_version:
                    raise Exception(
                        "Transaction version mismatch. Expected transaction version is: "
                        + str(current_transaction_version)
                        + ", but received transaction version is: "
                        + str(transaction_version)
                    )

                additions, updates, deletions = parse(
                    transaction,
                    config.tontine_module_address,
                    config.tontine_module_name,
                )

                with Session(engine) as session, session.no_autoflush, session.begin():
                    # Add new rows.
                    if additions:
                        session.add_all(additions)

                    # Make updates to rows.
                    if updates:
                        for update in updates:
                            session.query(TontineMembership).filter_by(
                                tontine_address=update.tontine_address,
                                member_address=update.member_address,
                            ).update(
                                {"has_ever_contributed": update.has_ever_contributed}
                            )

                    # Delete rows.
                    if deletions:
                        for deletion in deletions:
                            session.query(TontineMembership).filter_by(
                                tontine_address=deletion.tontine_address,
                                member_address=deletion.member_address,
                            ).delete()

                    # Update latest processed version.
                    session.merge(
                        NextVersionToProcess(
                            indexer_name=INDEXER_NAME,
                            next_version=current_transaction_version + 1,
                        )
                    )

                if (current_transaction_version % 1000) == 0:
                    logging.info(
                        json.dumps(
                            {
                                "message": "Successfully processed transaction",
                                "last_success_transaction_version": current_transaction_version,
                            }
                        )
                    )

                current_transaction_version += 1
