@echo off
REM Setup script for ML Service (Windows)

echo Setting up ML Dispatch Service...

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    (
        echo PORT=8000
        echo LOG_LEVEL=INFO
    ) > .env
    echo .env file created. Please edit it if needed.
)

REM Train initial model
echo Training initial model...
python scripts\train_model.py

echo.
echo Setup complete!
echo.
echo To start the service:
echo   venv\Scripts\activate
echo   uvicorn app.main:app --reload --port 8000
echo.
echo Or use Docker:
echo   docker-compose up ml-service

