import argparse
import logging
import time
from multiprocessing import Pool, set_start_method

from api import run_api
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

    # Wait for either of the processes to finish (which should never happen).
    while True:
        if p1.ready() or p2.ready():
            break
        time.sleep(0.1)

    if p1.ready():
        logging.error(f"API process unexpectedly exited: {p1.get()}")

    if p2.ready():
        logging.error(f"Processor process unexpectedly exited: {p2.get()}")

    p.close()


if __name__ == "__main__":
    main()
