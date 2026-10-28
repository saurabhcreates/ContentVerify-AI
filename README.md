# ContentVerify AI

**AI-Powered Image Authenticity Detection**

ContentVerify AI is a web-based application that uses a pretrained machine learning model to classify images as likely real or AI-generated.

## Features

* User registration and login
* Image upload and validation
* AI-powered image classification
* Prediction results with confidence scores
* User-specific analysis history
* Interactive web dashboard

## Technologies Used

### Backend

* Python
* FastAPI
* Uvicorn

### AI and Machine Learning

* PyTorch
* Hugging Face Transformers
* Vision Transformer (ViT)
* Model: `delpot/steganograph-ia-detector`

### Frontend

* HTML5
* CSS3
* JavaScript

### Database and Authentication

* SQLite
* SQLAlchemy
* Argon2 password hashing
* Signed session cookies

## Run Locally

1. Create and activate a Python virtual environment.

2. Install the dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Configure the required environment variables in your local `.env` file.

4. Start the application:

   ```bash
   python -m uvicorn backend.main:app
   ```

5. Open `http://127.0.0.1:8000/` in your browser.

## Limitations

* Image predictions may be incorrect and are not proof of authenticity.
* Video upload validation is available, but video deepfake detection is not implemented.

## Future Scope

* Video deepfake detection
* Improved model evaluation
* Explainable AI
* Downloadable analysis reports
* Cloud deployment

**Note:** This project is a prototype for AI-assisted image authenticity assessment.
