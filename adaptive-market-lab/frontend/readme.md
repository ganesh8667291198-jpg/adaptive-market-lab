Step 1: Start the Backend (FastAPI)

Open a terminal and run:

powershell
cd "c:\Users\User\Documents\ai project\adaptive-market-lab\backend"
python -m uvicorn app.main:app --reload --port 8000
API URL: http://localhost:8000
Interactive Swagger Docs: http://localhost:8000/docs
Configuration: app/main.py
Step 2: Start the Frontend (Vite + React)

Open a second terminal window and run:

powershell
cd "c:\Users\User\Documents\ai project\adaptive-market-lab\frontend"
npm run dev
Frontend App: http://localhost:5173
Configuration: package.json & vite.config.ts (proxies /api requests automatically to port 8000)