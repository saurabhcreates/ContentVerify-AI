# ContentVerify AI — Connected Frontend + FastAPI Demo

This package preserves your supplied frontend design and connects its Analyze button to a FastAPI backend.

## Run on Windows
Open a terminal in the extracted project root (the folder containing `requirements.txt`):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
```

If PowerShell blocks activation, use Command Prompt and run `.venv\Scripts\activate.bat`.

Open:
- Website: http://127.0.0.1:8000
- API health: http://127.0.0.1:8000/api/health
- Interactive API docs: http://127.0.0.1:8000/docs

## Current functionality
- Serves the original HTML/CSS/JS frontend.
- The Analyze button uploads the selected file to `/api/analyze`.
- FastAPI checks media type and size.
- OpenCV validates image decoding or reads basic video metadata.
- Temporary uploaded files are deleted after processing.
- Frontend displays a truthful backend validation status.

## Limitations
No deepfake detection model, database, login, or persistent history is included yet. The app does not decide whether a file is real or fake; any displayed score in the example/demo areas is illustrative only. Do not present it as an actual model prediction.
