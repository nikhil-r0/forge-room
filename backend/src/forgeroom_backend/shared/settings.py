import ast
import json
import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except Exception:  # pragma: no cover - compatibility fallback
    from pydantic import BaseModel

    class BaseSettings(BaseModel):
        def __init__(self, **data):
            resolved = {}
            model_config = getattr(self.__class__, "model_config", {}) or {}
            env_file = model_config.get("env_file")
            env_prefix = model_config.get("env_prefix", "")

            if env_file:
                env_path = Path(env_file)
                if env_path.exists():
                    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
                        line = raw_line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, value = line.split("=", 1)
                        resolved[key.strip()] = value.strip()

            for field_name, field_info in self.__class__.model_fields.items():
                env_key = f"{env_prefix}{field_name.upper()}"
                if env_key in os.environ:
                    raw_value = os.environ[env_key]
                elif env_key in resolved:
                    raw_value = resolved[env_key]
                else:
                    continue
                data.setdefault(field_name, _coerce_value(raw_value, field_info.annotation))

            super().__init__(**data)

    def SettingsConfigDict(**kwargs):
        return kwargs


def _coerce_value(raw_value, annotation):
    origin = getattr(annotation, "__origin__", None)
    if annotation is bool:
        return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}
    if annotation is int:
        return int(raw_value)
    if annotation is float:
        return float(raw_value)
    if annotation is list[str] or origin is list:
        try:
            return json.loads(raw_value)
        except Exception:
            return ast.literal_eval(raw_value)
    return raw_value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="FORGEROOM_",
        extra="ignore",
    )

    app_name: str = "ForgeRoom"
    database_url: str = "sqlite+pysqlite:///./forgeroom.db"
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])
    debounce_seconds: int = 4
    orchestrator_url: str = "http://localhost:8000"
    websocket_url: str = "ws://localhost:8002"
    target_repo_path: str = "./backend/demo_repo"
    allow_git_push: bool = False
    enable_demo_fallbacks: bool = True
    gemini_model: str = "gemini-1.5-flash"
    gemini_api_key: str | None = None
    service_timeout_seconds: int = 30

    @property
    def target_repo(self) -> Path:
        return Path(self.target_repo_path).expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings()
