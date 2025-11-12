// frontend/src/App.jsx
import React from 'react';
import ChatWindow from './components/ChatWindow';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Chatbot</h1>
        {/* <p>基于React + Koa.js + Server-Sent Events</p> */}
      </header>
      <main>
        <ChatWindow />
      </main>
    </div>
  );
}

export default App;