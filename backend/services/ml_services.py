import os
from typing import List, Dict, Any, Union

import requests


ML_SERVICE_URL = os.environ.get('ML_SERVICE_URL', 'http://127.0.0.1:8000')


def _open_file_obj(file_input: Union[str, bytes]):
	"""Return a file-like object and filename for a path or bytes.

	Caller is responsible for closing file objects returned when input is a path.
	"""
	if isinstance(file_input, (bytes, bytearray)):
		from io import BytesIO
		return BytesIO(file_input), 'image.jpg'
	if isinstance(file_input, str):
		# treat as file path
		f = open(file_input, 'rb')
		return f, os.path.basename(file_input)
	# assume file-like
	return file_input, getattr(file_input, 'name', 'image.jpg')


def predict_images(files: List[Union[str, bytes, Any]]) -> List[Dict[str, Any]]:
	"""Send multiple images to ML microservice `/predict` and return parsed results.

	Args:
		files: list of file paths, raw bytes, or file-like objects

	Returns:
		list of dicts: {filename, disease, confidence, severity} or {filename, error}
	"""
	url = ML_SERVICE_URL.rstrip('/') + '/predict'

	opened = []
	multipart = []
	try:
		for idx, f in enumerate(files):
			fo, name = _open_file_obj(f)
			opened.append(fo)
			multipart.append(('files', (name, fo, 'image/jpeg')))

		resp = requests.post(url, files=multipart, timeout=60)
		resp.raise_for_status()
		data = resp.json()

		results = []
		for p in data.get('predictions', []):
			if 'error' in p:
				results.append({'filename': p.get('filename'), 'error': p.get('error')})
			else:
				results.append({
					'filename': p.get('filename'),
					'disease': p.get('disease'),
					'confidence': float(p.get('confidence', 0.0)),
					'severity': p.get('severity')
				})
		return results
	finally:
		for fo in opened:
			try:
				fo.close()
			except Exception:
				pass


if __name__ == '__main__':
	# quick local test
	test_path = os.path.join(os.path.dirname(__file__), '..', 'uploads')
	print('ML_SERVICE_URL =', ML_SERVICE_URL)
