from __future__ import annotations

import json
from unittest.mock import patch
from fastapi.testclient import TestClient
from forgeroom_backend.execution.main import app

client = TestClient(app)

def test_execute_spec_comprehensive(temp_db_and_repo):
    """
    A comprehensive test that sends realistic parameters and prints 
    the full request/response cycle for verification.
    """
    _db, _repo_path = temp_db_and_repo
    
    # Real-world payload with all parameters
    payload = {
        "spec_markdown": "# Authentication Refactor\n\nImplement JWT-based authentication for the bridge.",
        "approved_decisions": [
            {
                "id": "dec-auth-001",
                "timestamp": "2026-04-24T14:30:00Z",
                "description": "Use pyjwt for token signing",
                "category": "auth",
                "depends_on": [],
                "contradicts": [],
                "risk_score": 0.05
            },
            {
                "id": "dec-auth-002",
                "timestamp": "2026-04-24T14:31:00Z",
                "description": "Store secret in environment variables",
                "category": "security",
                "depends_on": ["dec-auth-001"],
                "contradicts": [],
                "risk_score": 0.01
            }
        ],
        "commit_message": "feat(auth): implement jwt foundation",
        "push": True
    }
    
    # Realistic headers
    headers = {
        "X-Request-ID": "test-req-123",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    print("\n" + "="*80)
    print("TEST: Comprehensive Execute Spec")
    print("-" * 80)
    print(f"Request URL: /api/execute-spec")
    print(f"Request Headers: {json.dumps(headers, indent=2)}")
    print(f"Request Body:\n{json.dumps(payload, indent=2)}")
    print("-" * 80)

    # Mock the CLI output to simulate a successful run
    mock_cli_output = (
        "GEMINI-CLI EXECUTION LOG:\n"
        "1. Analyzed codebase snapshots.\n"
        "2. Identified missing 'jose' dependency, substituted with 'pyjwt' as per decision.\n"
        "3. Modified src/auth.py to include JWT encoding logic.\n"
        "4. Verified changes with local linting.\n"
        "5. Committed changes with message: feat(auth): implement jwt foundation\n"
        "6. Pushed to remote successfully.\n\n"
        "SUMMARY: JWT authentication foundation has been established."
    )

    with patch("forgeroom_backend.execution.gemini_cli.shutil.which", return_value="/usr/local/bin/gemini"):
        with patch("forgeroom_backend.execution.gemini_cli.subprocess.run") as mock_run:
            mock_run.return_value.returncode = 0
            mock_run.return_value.stdout = mock_cli_output
            mock_run.return_value.stderr = ""
            
            response = client.post("/api/execute-spec", json=payload, headers=headers)
            
            # Verify the internal prompt construction included our params
            _, kwargs = mock_run.call_args
            prompt_sent = kwargs.get("input", "")
            assert "feat(auth): implement jwt foundation" in prompt_sent
            assert "push the changes" in prompt_sent.lower()

    print(f"Response Status Code: {response.status_code}")
    print(f"Response Body:\n{json.dumps(response.json(), indent=2)}")
    print("="*80 + "\n")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["summary"] == mock_cli_output
