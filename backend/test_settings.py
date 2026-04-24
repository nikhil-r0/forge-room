import sys
from pathlib import Path
sys.path.append(str(Path.cwd() / "src"))
from forgeroom_backend.shared.settings import get_settings
try:
    s = get_settings()
    print("SUCCESS")
    print(s.model_dump())
except Exception as e:
    print(f"FAILURE: {e}")
    import traceback
    traceback.print_exc()
