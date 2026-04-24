## ForgeRoom AI Notes

The AI layer is implemented inside the backend orchestrator service rather than as a separate process.

### Implemented Capabilities

- supervisor extraction for goals, decisions, tasks, and conflicts
- architectural drift detection against a real target repository snapshot
- AppSec agent review over approved decisions plus security-relevant code
- risk autopsy report generation for session export

### Provider Model

`forgeroom_backend.orchestrator.providers.AIProvider` is the single AI entry point.

- If `langchain-google-genai` and `FORGEROOM_GEMINI_API_KEY` are available, the provider can call Gemini.
- If they are not available, the backend falls back to deterministic local heuristics so the product still works in demo/dev mode.

### Prompt Ownership

Prompt templates live in:

- `backend/src/forgeroom_backend/orchestrator/prompts.py`

### Runtime Behavior

- the supervisor operates on recent persisted chat
- new approved decisions trigger drift checks automatically
- exports always include a risk autopsy
- AppSec runs on demand per room
