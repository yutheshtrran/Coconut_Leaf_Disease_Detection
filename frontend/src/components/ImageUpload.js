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
        } else {
            setError('Please select an image to upload.');
        }
    };

    return (
        <div className="image-upload">
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {error && <p className="error">{error}</p>}
            {selectedImage && <img src={selectedImage} alt="Selected" className="preview" />}
            <button onClick={handleUpload} className="upload-button">Upload Image</button>
        </div>
    );
};

export default ImageUpload;