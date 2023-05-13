from api import run_api
from config import Config
from processor import run_processor
from threading import Thread

import grpc
from aptos.indexer.v1 import raw_data_pb2

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import argparse
import json


def parse_config():
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--config", help="Path to config file", required=True)
    args = parser.parse_args()
    return Config.from_yaml_file(args.config)


def main():
    config = parse_config()
    engine = create_engine(config.db_connection_uri)

    # Spawn the processor in the background.
    handle = Thread(target=run_processor, args=(config, engine))
    handle.start()

    run_api(config, engine)

    handle.join()


if __name__ == "__main__":
    main()
