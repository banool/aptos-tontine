from config import Config
from create_table import TontineMembership
from sqlalchemy.orm import Session
from flask import Flask, request
from flask_cors import CORS


def run_api(config: Config, engine):
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
        print(f"Received request to get tontines for {address}")
        with Session(engine) as session:
            objects = session.query(TontineMembership).filter_by(member_address=address).all()
        return [obj.tontine_address for obj in objects]

    # This is only recommend for development purposes. For production deployment,
    # you're meant to use a proper web server stack like gunicorn + nginx.
    app.run(port=config.api_port, debug=True)
