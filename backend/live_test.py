import subprocess
import time
import urllib.request
import json
import sys
import os


def main():
    print("Starting FastAPI server in the background...")

    # Set PYTHONPATH so it can find forgeroom_backend
    env = os.environ.copy()
    env["PYTHONPATH"] = "src"

    server = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "forgeroom_backend.execution.main:app",
            "--port",
            "8123",
        ],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Give the server a few seconds to start up
    time.sleep(3)

    payload = {
        "spec_markdown": "Please respond with a short message confirming this live test works.",
        "approved_decisions": [
            {
                "id": "dec-live-1",
                "timestamp": "2026-04-24T12:00:00Z",
                "description": "Build a small dashboard using html css and js",
                "category": "general",
                "depends_on": [],
                "contradicts": [],
                "risk_score": 0.0,
            }
        ],
        "commit_message": "chore: live HTTP test",
        "push": False,
    }

    req = urllib.request.Request(
        "http://localhost:8123/api/execute-spec",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    try:
        print(
            "\nSending live HTTP POST request to http://localhost:8123/api/execute-spec..."
        )
        print("Payload:")
        print(json.dumps(payload, indent=2))
        print("-" * 50)

        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            print(f"Response Status Code: {response.status}")
            print("Response Body:")
            print(json.dumps(json.loads(body), indent=2))
    except urllib.error.URLError as e:
        print(f"HTTP Error: {e}")
        if hasattr(e, "read"):
            print(e.read().decode("utf-8"))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        print("\nTerminating FastAPI server...")
        server.terminate()
        server.wait()


if __name__ == "__main__":
    main()
