## Tontine Processor
This is an all-in-one processor for the Tontine module. This processor results in the `tontine_membership` table, which tracks what tontines exist and who their members are. We also track whether a member is the creator of the tontine or not.

Currently it does not do more than that, the table is meant only for making it possible to look up what tontines a member is a part of. The frontend will use this API and then retrieve the rest of the information via a fullnode API.

This processor is written to be as simple deploy as possible:
- Both the processor and the API are run from the same process.
- We use sqlite as the DB.

### Prerequisites
- Python 3.11 or higher

### Tutorial
## Development
### Install all dependencies
```bash
poetry install
```

Run:
```
poetry run python main.py -c config/example.yaml
```

### Linting & autoformatting
```bash
poe isort
poe black
```

