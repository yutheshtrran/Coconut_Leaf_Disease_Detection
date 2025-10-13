import React, { useState } from 'react';

const ImageUpload = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [error, setError] = useState('');

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (validTypes.includes(file.type)) {
        setSelectedImage(URL.createObjectURL(file));
        setError('');
      } else {
        setError('Please select a valid image file (JPEG, PNG, GIF).');
      }
    }
  };

  const handleUpload = () => {
    if (selectedImage) {
      // Logic to upload the image to the server
      console.log('Image uploaded:', selectedImage);
      alert('Image uploaded successfully!'); // Temporary feedback
    } else {
      setError('Please select an image to upload.');
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="border rounded p-2"
      />
      {error && <p className="text-red-500">{error}</p>}
      {selectedImage && (
        <img
          src={selectedImage}
          alt="Selected"
          className="w-64 h-64 object-cover rounded shadow"
        />
      )}
      <button
        onClick={handleUpload}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      >
        Upload Image
      </button>
    </div>
  );
};

export default ImageUpload;
