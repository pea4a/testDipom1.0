import React, { useState, useEffect } from 'react';
import EC from 'elliptic';
import CryptoJS from 'crypto-js';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";
import './App.css';

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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
  const [chatMessages, setChatMessages] = useState([]);
  const [userKeys, setUserKeys] = useState({});

  useEffect(() => {
    // Отримуємо повідомлення з Firebase
    const messagesRef = ref(db, 'messages/');
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesArray = Object.values(data);
        setChatMessages(messagesArray);
      }
    });

    // Отримуємо ключі користувачів з Firebase
    const keysRef = ref(db, 'keys/');
    onValue(keysRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const keys = {};
        Object.keys(data).forEach(user => {
          keys[user] = {
            keyPair: ec.keyFromPrivate(data[user].privateKey, 'hex'),
          };
        });
        setUserKeys(keys);
      }
    });
  }, []);

  const handleLogin = () => {
    if (users[login] && users[login].password === password) {
      setCurrentUser(login);
    } else {
      alert('Невірний логін або пароль');
    }
  };

  const encryptMessage = (recipient) => {
    const sender = currentUser;
    if (!userKeys[sender] || !userKeys[recipient]) {
      alert('Неможливо знайти ключі для користувачів');
      return;
    }

    const senderKeyPair = userKeys[sender].keyPair;
    const recipientPublicKey = ec.keyFromPublic(userKeys[recipient].keyPair.getPublic('hex'), 'hex');

    const sharedSecret = senderKeyPair.derive(recipientPublicKey.getPublic());
    const sharedSecretHex = sharedSecret.toString(16);
    const encrypted = CryptoJS.AES.encrypt(message, sharedSecretHex).toString();
    return encrypted;
  };

  const decryptMessage = (encryptedMessage, sender) => {
    const recipient = currentUser;
    if (!userKeys[recipient] || !userKeys[sender]) {
      alert('Неможливо знайти ключі для користувачів');
      return 'Помилка при дешифруванні';
    }

    const recipientKeyPair = userKeys[recipient].keyPair;
    const senderPublicKey = ec.keyFromPublic(userKeys[sender].keyPair.getPublic('hex'), 'hex');

    const sharedSecret = recipientKeyPair.derive(senderPublicKey.getPublic());
    const sharedSecretHex = sharedSecret.toString(16);
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, sharedSecretHex).toString(CryptoJS.enc.Utf8);
    return decrypted || 'Помилка при дешифруванні';
  };

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

    const messagesRef = ref(db, 'messages/' + Date.now());
    set(messagesRef, newMsg);

    setChatMessages(prevMessages => [...prevMessages, newMsg]);
    setMessage('');
  };

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
      <div className="login-container">
        <div className="login-box">
          <h1>вітаємо</h1>
          <p>авторизуйтесь для продовження</p>
          <input
            type="text"
            placeholder="ІМ'Я"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
          <input
            type="password"
            placeholder="ПАРОЛЬ"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleLogin}>увійти</button>
        </div>
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
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} />
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
