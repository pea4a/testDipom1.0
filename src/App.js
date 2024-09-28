import React, { useState, useEffect } from 'react';
import EC from 'elliptic';
import CryptoJS from 'crypto-js';
import messages from './messages';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, get } from "firebase/database";

const ec = new EC.ec('secp256k1');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBrM1KkCfH6ey2PMhUxXsuy58wlQXTbJcE",
  authDomain: "testreact-f3af2.firebaseapp.com",
  databaseURL: "https://testreact-f3af2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testreact-f3af2",
  storageBucket: "testreact-f3af2.appspot.com",
  messagingSenderId: "948033424433",
  appId: "1:948033424433:web:bea705b21ed3d46a7a9910"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Список користувачів із логінами та паролями
const users = {
  alice: { password: 'alice123' },
  bob: { password: 'bob123' },
  carl: { password: 'carl123' },
};

function App() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [recipient, setRecipient] = useState('bob');
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState(messages);
  const [userKeys, setUserKeys] = useState({});

  // Ініціалізація ключів та отримання повідомлень з Firebase
  useEffect(() => {
    const storedMessages = JSON.parse(localStorage.getItem('chatMessages')) || [];
    const storedKeys = JSON.parse(localStorage.getItem('userKeys')) || {};

    const now = Date.now();
    Object.keys(storedKeys).forEach((user) => {
      if (now - storedKeys[user].timestamp > 3600000) { // 1 година
        storedKeys[user].keyPair = ec.genKeyPair();
        storedKeys[user].timestamp = now;
      }
    });

    setUserKeys(storedKeys);
    setChatMessages(storedMessages);

    // Отримуємо повідомлення з Firebase
    const messagesRef = ref(db, 'messages/');
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesArray = Object.values(data);
        setChatMessages(messagesArray);
      }
    });
  }, []);

  // Авторизація користувача
  const handleLogin = () => {
    if (users[login] && users[login].password === password) {
      if (!userKeys[login]) {
        const keyPair = ec.genKeyPair();
        userKeys[login] = { keyPair, timestamp: Date.now() };
        setUserKeys({ ...userKeys });
        localStorage.setItem('userKeys', JSON.stringify(userKeys));
      }
      setCurrentUser(login);
    } else {
      alert('Невірний логін або пароль');
    }
  };

  // Зміна повідомлення
  const handleMessageChange = (event) => {
    setMessage(event.target.value);
  };

  // Шифрування повідомлення
  const encryptMessage = (recipient) => {
    const sender = currentUser;
    if (!userKeys[sender] || !userKeys[recipient]) {
      alert('Неможливо знайти ключі для користувачів');
      return;
    }
    const sharedSecret = userKeys[sender].keyPair.derive(userKeys[recipient].keyPair.getPublic());
    const sharedSecretHex = sharedSecret.toString(16);
    const encrypted = CryptoJS.AES.encrypt(message, sharedSecretHex).toString();
    return encrypted;
  };

  // Відправка повідомлення
  const sendMessage = () => {
    if (!message) return;
    const encrypted = encryptMessage(recipient);
    if (!encrypted) return;

    const newMsg = {
      sender: currentUser,
      recipient: recipient,
      message: encrypted,
      encrypted: true,
    };

    // Додаємо повідомлення до Firebase
    const messagesRef = ref(db, 'messages/' + Date.now());
    set(messagesRef, newMsg);

    // Додаємо повідомлення до історії чату
    const updatedMessages = [...chatMessages, newMsg];
    setChatMessages(updatedMessages);
    localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
    setMessage('');
  };

  // Показ повідомлень для поточного користувача
  const displayMessages = () => {
    return chatMessages.map((msg, index) => {
      if (msg.recipient === currentUser) {
        const decrypted = decryptMessage(msg.message, msg.sender);
        return (
          <div key={index}>
            <strong>{msg.sender}:</strong> {decrypted}
          </div>
        );
      } else if (msg.sender === currentUser) {
        return (
          <div key={index}>
            <strong>{msg.sender}:</strong> {msg.message}
          </div>
        );
      } else {
        return (
          <div key={index}>
            <strong>{msg.sender}:</strong> <em>Зашифроване повідомлення</em>
          </div>
        );
      }
    });
  };

  if (!currentUser) {
    return (
      <div>
        <h1>Авторизація</h1>
        <input
          type="text"
          placeholder="Логін"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>Увійти</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Чат</h1>
      <div>
        <h2>Ви увійшли як: {currentUser}</h2>
        <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
          <option value="alice">Аліса</option>
          <option value="bob">Боб</option>
          <option value="carl">Карл</option>
        </select>
      </div>

      <div>
        <h2>Повідомлення</h2>
        <textarea value={message} onChange={handleMessageChange} />
        <button onClick={sendMessage}>Відправити</button>
      </div>

      <div>
        <h2>Чат:</h2>
        {displayMessages()}
      </div>
    </div>
  );
}

export default App;
