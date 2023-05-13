import argparse
import logging
from multiprocessing import Pool, set_start_method

from api import run_api
from aptos.indexer.v1 import raw_data_pb2
from config import Config
from processor import run_processor


def parse_config():
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--config", help="Path to config file", required=True)
    args = parser.parse_args()
    return Config.from_yaml_file(args.config)


def main():
    config = parse_config()
    logging.basicConfig(
        level="INFO", format="%(asctime)s - %(levelname)s - %(message)s"
    )

    logging.info("Spawning processors for the processor and api...")

    set_start_method("fork")

    p = Pool(2)
    p1 = p.apply_async(run_api, [(config)])
    p2 = p.apply_async(run_processor, [(config)])

    logging.info(
        "Spawned processors for the processor and api, waiting for them "
        "indefinitely..."
    )

    p1.get()
    p2.get()

    p.close()


if __name__ == "__main__":
    main()
