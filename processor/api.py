import logging
import os
import typing

from flask import Flask
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from config import Config
from tables import TontineMembership, TontineState, TontineStateEnum


def run_api(config: Config):
    logging.info(f"Running API at pid {os.getpid()}...")

    engine = create_engine(config.db_connection_uri)

    app = Flask(__name__)
    CORS(app)
    # Pass the config in to the app config.
    app.config.update(config=config)

    @app.route("/", methods=["GET"])
    def index():
        return "Healthy!"

    # Get tontines an address is part of.
    @app.route("/tontines/<address>", methods=["GET"])
    def tontines(address):
        logging.info(f"Received request to get tontines for {address}")
        with Session(engine) as session:
            memberships: typing.List[TontineMembership] = (
                session.query(TontineMembership).filter_by(member_address=address).all()
            )
            tontine_addresses = {m.tontine_address for m in memberships}
            states: typing.List[TontineState] = (
                session.query(TontineState)
                .filter(TontineState.tontine_address.in_(tontine_addresses))
                .all()
            )

        tontine_address_to_state = {s.tontine_address: s.state for s in states}

        out = []
        for membership in memberships:
            out.append(
                {
                    "tontine_address": membership.tontine_address,
                    "is_creator": membership.is_creator,
                    "has_ever_contributed": membership.has_ever_contributed,
                    # 0 and 1 are staging and locked. The absence of a row is
                    # considered "complete", which we represent by -1.
                    "state": tontine_address_to_state.get(
                        membership.tontine_address, -1
                    ),
                }
            )
        return out

    # This is only recommend for development purposes. For production deployment,
    # you're meant to use a proper web server stack like gunicorn + nginx.
    app.run(port=config.api_port)
