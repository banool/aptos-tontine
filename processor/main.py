import argparse
import logging
from multiprocessing import Pool, set_start_method

from api import run_api
from aptos.indexer.v1 import raw_data_pb2
from config import Config
from processor import run_processor

LOG = logging.getLogger(__name__)
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
ch = logging.StreamHandler()
ch.setFormatter(formatter)
LOG.addHandler(ch)


def parse_config():
    parser = argparse.ArgumentParser()
    parser.add_argument("-c", "--config", help="Path to config file", required=True)
    args = parser.parse_args()
    return Config.from_yaml_file(args.config)


def main():
    config = parse_config()

    set_start_method("forkserver")
    with Pool(5) as p:
        p.map(run_api, [(config)])
        p.map(run_processor, [(config)])


if __name__ == "__main__":
    main()
