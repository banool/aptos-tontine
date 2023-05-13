import logging
import os
import typing

from flask import Flask
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from config import Config
from table import TontineMembership


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
            objects: typing.List[TontineMembership] = (
                session.query(TontineMembership).filter_by(member_address=address).all()
            )
        out = []
        for o in objects:
            out.append(
                {
                    "tontine_address": o.tontine_address,
                    "is_creator": o.is_creator,
                }
            )
        return out

    # This is only recommend for development purposes. For production deployment,
    # you're meant to use a proper web server stack like gunicorn + nginx.
    app.run(port=config.api_port)
