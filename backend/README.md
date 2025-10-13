# Coconut Leaf Detection Application

This repository contains the backend code for the Coconut Leaf Detection application. The application is designed to detect and analyze coconut leaf images for various purposes, including identifying nutritional and parasitic issues.

## Project Structure

The project is organized into several directories, each serving a specific purpose:

- **backend/**: Contains the backend server code, including models, controllers, routes, and services.
- **data/**: Holds all coconut leaf image data, organized into raw, annotated, processed, and splits subdirectories.
- **docs/**: Contains documentation files, including proposals, design diagrams, reports, and references.
- **ml/**: Includes the machine learning module with Jupyter notebooks for data exploration, model training, and evaluation.
- **frontend/**: Contains the frontend code, including configuration files for Tailwind CSS and Vite, as well as the main application files.
- **deployment/**: Holds files related to deployment, including Nginx configuration and deployment scripts.

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- MongoDB (for database)
- Docker (for containerization)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/coconut-leaf-detection.git
   cd coconut-leaf-detection/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the `backend` directory and configure your environment variables.

4. Start the server:
   ```
   node server.js
   ```

### API Endpoints

The backend provides several API endpoints for interacting with the application. Refer to the documentation in the `docs/` directory for detailed information on the available endpoints and their usage.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.