import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { Web3Provider } from "./contexts/Web3Context";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Web3Provider>
        <AuthProvider>
          <App />
          <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
        </AuthProvider>
      </Web3Provider>
    </BrowserRouter>
  </React.StrictMode>
);
