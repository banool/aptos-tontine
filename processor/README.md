## Aptos Tontine: Processor
This is an all-in-one processor for the Tontine module. It processes events from the txn stream to populate the `tontine_membership` and `tontine_state` tables. These tables track repesctively what tontines exist and who their members are, and what the basic state of the tontines are.

In addition to the processor, it exposes an API that lets you lookup what tontines someone is a part of and this basic state information.

The intent of the processor is only for discovering tontine membership and basic state for the purposes of displaying all the tontines a user is part of in the UI. It is not meant to be the one stop shop for information about tontines, it is just the entry point and then additional information can be retrieved from the fullnode API and view functions.

This processor is written to be as simple deploy as possible:
- Both the processor and the API are run from the same process.
- We use sqlite as the DB.

### Prerequisites
- Python 3.11 or higher

## Development
### Install all dependencies
```bash
poetry install
```

Run:
```
poetry run python main.py -c config/testnet.yaml
```

### Linting & autoformatting
```bash
poetry run isort .
poetry run python -m black .
```

