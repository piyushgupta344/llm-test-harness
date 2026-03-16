export class HarnessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HarnessError'
  }
}

export class CassetteMissError extends HarnessError {
  constructor(public readonly hash: string) {
    super(
      `No cassette interaction found for request hash "${hash}". ` +
        `Run with mode: 'record' to capture the interaction.`,
    )
    this.name = 'CassetteMissError'
  }
}

export class CassetteOverwriteError extends HarnessError {
  constructor(public readonly hash: string) {
    super(
      `A cassette interaction with hash "${hash}" already exists and noOverwrite is true.`,
    )
    this.name = 'CassetteOverwriteError'
  }
}

export class CassetteWriteError extends HarnessError {
  constructor(
    public readonly filePath: string,
    cause: unknown,
  ) {
    super(
      `Failed to write cassette file at "${filePath}": ${cause instanceof Error ? cause.message : String(cause)}`,
    )
    this.name = 'CassetteWriteError'
  }
}

export class UnsupportedClientError extends HarnessError {
  constructor() {
    super(
      'Unsupported client type. Pass an Anthropic or OpenAI client instance to harness.wrap().',
    )
    this.name = 'UnsupportedClientError'
  }
}
