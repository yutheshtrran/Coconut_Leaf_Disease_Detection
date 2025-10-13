import React from 'react';
import ImageUpload from '../components/ImageUpload';

const Upload = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <h1 className="text-2xl font-bold mb-4">Upload Coconut Leaf Images</h1>
            <p className="mb-6">Please upload images of coconut leaves for detection.</p>
            <ImageUpload />
        </div>
    );
};

export default Upload;