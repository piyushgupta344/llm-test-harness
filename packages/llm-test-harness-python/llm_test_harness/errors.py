class HarnessError(Exception):
    pass


class CassetteMissError(HarnessError):
    def __init__(self, hash_: str) -> None:
        self.hash = hash_
        super().__init__(
            f'No cassette interaction found for request hash "{hash_}". '
            f"Run with mode='record' to capture the interaction."
        )


class CassetteOverwriteError(HarnessError):
    def __init__(self, hash_: str) -> None:
        self.hash = hash_
        super().__init__(
            f'A cassette interaction with hash "{hash_}" already exists and no_overwrite is True.'
        )


class CassetteWriteError(HarnessError):
    def __init__(self, file_path: str, cause: Exception) -> None:
        self.file_path = file_path
        super().__init__(f'Failed to write cassette file at "{file_path}": {cause}')


class UnsupportedClientError(HarnessError):
    def __init__(self) -> None:
        super().__init__(
            "Unsupported client type. Pass an Anthropic or OpenAI client instance to harness.wrap()."
        )
