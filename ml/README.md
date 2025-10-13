# Machine Learning Module for Coconut Leaf Detection

This directory contains the machine learning module for the Coconut Leaf Detection application. It includes various components essential for developing, training, and evaluating machine learning models.

## Directory Structure

- **notebooks/**: Contains Jupyter notebooks for exploratory data analysis (EDA), model training, evaluation, and data augmentation demonstrations.
  - `eda.ipynb`: Notebook for data exploration and visualization.
  - `model_training.ipynb`: Notebook for training machine learning models.
  - `evaluation.ipynb`: Notebook for evaluating model performance on test data.
  - `augmentation_demo.ipynb`: Notebook demonstrating data augmentation techniques.

- **src/**: Contains source code for the machine learning module.
  - `data_loader.py`: Script for loading and preprocessing datasets.
  - `model.py`: Defines the architecture of the machine learning model (e.g., CNN or YOLO).
  - `train.py`: Script for training the model.
  - `evaluate.py`: Script for evaluating the trained model.
  - `inference.py`: Script for performing inference on single images.
  - `metrics.py`: Contains functions for calculating accuracy, precision, recall, and other metrics.
  - `utils.py`: Helper functions used throughout the module.
  - `config.yaml`: Configuration file for hyperparameters and settings.

- **weights/**: Directory to store saved model weights (e.g., `.pt` or `.h5` files).

- **ai_api/**: Contains the API for serving the machine learning model.
  - `app.py`: Main application file for the Flask/FastAPI microservice.
  - `requirements.txt`: Lists the dependencies required for the API.
  - `Dockerfile`: Docker configuration for the API.
  - `test/`: Contains tests for the API.
    - `test_api.py`: Test cases for the API endpoints.

## Usage

1. **Data Preparation**: Ensure that the data is organized in the `data/` directory as specified.
2. **Model Training**: Use the `model_training.ipynb` notebook to train the model on the prepared dataset.
3. **Model Evaluation**: Evaluate the model using the `evaluation.ipynb` notebook.
4. **Inference**: Use the `inference.py` script to perform predictions on new images.
5. **API Deployment**: Deploy the API using the provided Docker configuration.

## Requirements

Ensure that you have the necessary libraries installed as specified in `requirements.txt` for the AI API and any additional libraries required for the machine learning module.