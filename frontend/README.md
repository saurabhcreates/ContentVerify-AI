# ContentVerify AI

A responsive, browser-only frontend prototype inspired by the supplied dashboard reference. It runs without a build step or third-party packages.

## Run locally

From this folder, start a static web server:

```powershell
python -m http.server 4173
```

Then open <http://localhost:4173>.

## What works

- Responsive dashboard navigation for Dashboard, Analyze Media, History, Reports, and Settings.
- Drag-and-drop or file picker for JPG, PNG, WEBP, MP4, and MOV files up to 100 MB.
- Local image and video preview, file metadata, session-only analysis history, and downloadable JSON reports.
- Preview analysis flow that explains when a real detection model is not connected.

## Important

This is a frontend prototype. It does not include an AI model or backend. The preloaded 82.7% result is labelled as example data; uploaded files are inspected locally for basic file details only, and no authenticity or deepfake determination is made. Media files are not uploaded or stored by this app.
