// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 如果你想要测量应用性能，可以传递一个函数
// 用于记录结果（例如: reportWebVitals(console.log)）
// 或发送到分析终端。了解更多: https://bit.ly/CRA-vitals
reportWebVitals();