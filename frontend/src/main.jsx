import React from "react";
import ReactDOM from "react-dom/client";
// During diagnosis we load a minimal app to confirm React mounts.
// Swap back to ./App.jsx after verifying.
import App from "./App.jsx";
import "./index.css"; // 👈 This line is REQUIRED
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
