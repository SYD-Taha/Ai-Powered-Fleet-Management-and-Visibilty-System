#!/bin/bash
# Setup script for ML Service

echo "Setting up ML Dispatch Service..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOF
PORT=8000
LOG_LEVEL=INFO
EOF
    echo ".env file created. Please edit it if needed."
fi

# Train initial model
echo "Training initial model..."
python scripts/train_model.py

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the service:"
echo "  source venv/bin/activate"
echo "  uvicorn app.main:app --reload --port 8000"
echo ""
echo "Or use Docker:"
echo "  docker-compose up ml-service"

