import requests

def test_api_prediction():
    url = "http://localhost:5000/predict"  # Update with your API endpoint
    test_image_path = "path/to/test/image.jpg"  # Update with a valid image path

    with open(test_image_path, 'rb') as image_file:
        response = requests.post(url, files={'file': image_file})

    assert response.status_code == 200, "Expected status code 200"
    assert 'prediction' in response.json(), "Response should contain 'prediction' key"
    print("Test passed. Prediction:", response.json()['prediction'])

if __name__ == "__main__":
    test_api_prediction()