// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
// 1. Importe o Provider
import { HeroUIProvider } from "@heroui/react";
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* 2. Envolva sua aplicação com o Provider */}
    <HeroUIProvider>
      <App />
    </HeroUIProvider>
  </React.StrictMode>
);