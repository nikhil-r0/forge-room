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
                        # Strip whitespace and potential quotes
                        val = value.strip()
                        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                            val = val[1:-1]
                        resolved[key.strip()] = val

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
    if annotation is bool or origin is bool:
        return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}
    if annotation is int or origin is int:
        return int(raw_value)
    if annotation is float or origin is float:
        return float(raw_value)
    if annotation is list[str] or origin is list or (origin is not None and issubclass(origin, list)):
        try:
            # Try JSON first
            return json.loads(raw_value)
        except Exception:
             try:
                 # Try AST literal eval (handles single quotes)
                 val = ast.literal_eval(raw_value)
                 return val if isinstance(val, list) else [str(val)]
             except Exception:
                 # Fallback to comma-separated string
                 if "," in raw_value:
                     return [s.strip() for s in raw_value.split(",")]
                 # Final fallback: wrap single value in list (handles "*" cases)
                 stripped = raw_value.strip()
                 if (stripped.startswith("[") and stripped.endswith("]")):
                     # If it looks like [*] or [a,b] but JSON failed, try cleaning it
                     content = stripped[1:-1].strip()
                     if not content: return []
                     return [s.strip().strip("'").strip('"') for s in content.split(",")]
                 return [stripped]
    return raw_value


def find_env_file() -> str:
    # Try current directory first
    current = Path.cwd()
    if (current / ".env").exists():
        return str(current / ".env")
    
    # Check parent of 'backend' or 'src'
    try:
        # File is in backend/src/forgeroom_backend/shared/settings.py
        # Root is 5 levels up
        root = Path(__file__).resolve().parents[4]
        if (root / ".env").exists():
            return str(root / ".env")
    except Exception:
        pass
        
    return ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=find_env_file(),
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
    debug_mode: bool = False

    @property
    def target_repo(self) -> Path:
        return Path(self.target_repo_path).expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Log configuration source for visibility
    env_file = settings.model_config.get("env_file")
    print(f"\n[Settings] Loading configuration (env_file={env_file})")
    
    prefix = settings.model_config.get("env_prefix", "")
    # To detect if it was loaded from env, we compare with class defaults
    # but that's complex. Instead, we can check if it's in the env file if we parse it again.
    
    # Simpler: just show the final values in debug mode
    for field_name, value in settings.model_dump().items():
        env_key = f"{prefix}{field_name.upper()}"
        source = "OS_ENV" if env_key in os.environ else "FILE/DEFAULT"
        if "key" in field_name.lower() or "token" in field_name.lower():
            display_val = "***" if value else "None"
        else:
            display_val = value
        print(f"  ✓ {field_name:25} = {display_val} ({source})")
    print("")
    return settings
