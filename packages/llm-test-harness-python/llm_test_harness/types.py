from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Literal, Optional, Union

CassetteMode = Literal["record", "replay", "passthrough", "hybrid"]
Provider = Literal["anthropic", "openai", "http"]


@dataclass
class CassetteMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass
class CassetteParams:
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_tokens: Optional[int] = None
    stop: Optional[Union[str, list[str]]] = None


@dataclass
class CassetteTool:
    name: str
    description: Optional[str] = None


@dataclass
class CassetteRequest:
    provider: Provider
    model: str
    messages: list[CassetteMessage]
    params: CassetteParams
    system: Optional[str] = None
    tools: Optional[list[CassetteTool]] = None


@dataclass
class CassetteUsage:
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


@dataclass
class CassetteContentBlock:
    type: str
    text: Optional[str] = None
    id: Optional[str] = None
    name: Optional[str] = None
    input: Optional[Any] = None


@dataclass
class CassetteResponse:
    # "message" for Anthropic, "chat.completion" for OpenAI, "stream_chunks", "error"
    type: str
    content: Optional[list[CassetteContentBlock]] = None
    chunks: Optional[list[str]] = None
    usage: Optional[CassetteUsage] = None
    stop_reason: Optional[str] = None
    finish_reason: Optional[str] = None
    error: Optional[dict[str, str]] = None


@dataclass
class CassetteMetadata:
    recorded_at: str
    duration_ms: int
    provider_request_id: Optional[str] = None


@dataclass
class CassetteInteraction:
    id: str
    request: CassetteRequest
    response: CassetteResponse
    metadata: CassetteMetadata


@dataclass
class CassetteFile:
    version: int
    interactions: list[CassetteInteraction] = field(default_factory=list)


@dataclass
class HarnessConfig:
    cassettes_dir: str
    cassette_name: str = "cassette"
    mode: CassetteMode = "replay"
    no_overwrite: bool = False
    on_before_record: Optional[Callable[[CassetteInteraction], CassetteInteraction]] = None


# Alias — in Python the config already has resolved defaults
ResolvedHarnessConfig = HarnessConfig


@dataclass
class MetricScore:
    name: str
    passed: bool
    score: float
    reason: Optional[str] = None


@dataclass
class EvalResult:
    passed: bool
    pass_rate: float
    scores: list[MetricScore]


@dataclass
class BaselineEntry:
    metric_name: str
    score: float
    passed: bool


@dataclass
class BaselineSnapshot:
    version: int
    created_at: str
    test_name: str
    entries: list[BaselineEntry]


@dataclass
class RegressionEntry:
    metric_name: str
    baseline_score: float
    current_score: float
    delta: float


@dataclass
class RegressionResult:
    has_regression: bool
    regressions: list[RegressionEntry]
    improvements: list[RegressionEntry]


class MetricFn(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def evaluate(self, text: str) -> MetricScore: ...
