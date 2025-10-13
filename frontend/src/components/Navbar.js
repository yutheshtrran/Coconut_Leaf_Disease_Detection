import React from 'react';

const Navbar = () => {
    return (
        <nav className="bg-green-500 p-4">
            <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-white text-2xl font-bold">Coconut Leaf Detection</h1>
                <ul className="flex space-x-4">
                    <li>
                        <a href="/" className="text-white hover:text-gray-200">Home</a>
                    </li>
                    <li>
                        <a href="/upload" className="text-white hover:text-gray-200">Upload</a>
                    </li>
                    <li>
                        <a href="/reports" className="text-white hover:text-gray-200">Reports</a>
                    </li>
                    <li>
                        <a href="/alerts" className="text-white hover:text-gray-200">Alerts</a>
                    </li>
                    <li>
                        <a href="/login" className="text-white hover:text-gray-200">Login</a>
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;