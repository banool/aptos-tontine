import yaml
from pydantic import BaseSettings, Field
from pydantic.env_settings import SettingsSourceCallable


class Config(BaseSettings):
    chain_id: int
    indexer_endpoint: str
    indexer_api_key: str
    # If there is no minimum version in the DB, this is the version to start processing from.
    starting_version: int | None = None
    # Even if there is a minimum version in the DB, start processor from this version.
    starting_version_override: int | None = None
    db_connection_uri: str
    tontine_module_address: str
    tontine_module_name: str
    api_port: int | None = None
    run_processor: bool = True

    class Config:
        # change order of priority of settings sources such that environment variables take precedence over config file settings
        # inspired by https://docs.pydantic.dev/usage/settings/#changing-priority
        @classmethod
        def customise_sources(
            cls,
            init_settings: SettingsSourceCallable,
            env_settings: SettingsSourceCallable,
            file_secret_settings: SettingsSourceCallable,
        ) -> tuple[SettingsSourceCallable, ...]:
            return env_settings, init_settings, file_secret_settings

    @classmethod
    def from_yaml_file(cls, path: str):
        with open(path, "r") as file:
            config = yaml.safe_load(file)

        return cls(**config)
