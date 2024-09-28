import React, { useState, useEffect } from 'react';
import EC from 'elliptic';
import CryptoJS from 'crypto-js';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, get, child } from "firebase/database";

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
    const messagesRef = ref(db, 'messages/');
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesArray = Object.values(data);
        setChatMessages(messagesArray);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (users[login] && users[login].password === password) {
      console.log('User logged in:', login);
      const userRef = ref(db, `users/${login}`);

      // Спроба отримати ключі користувача з Firebase
      const snapshot = await get(userRef);
      let keyPair;

      if (snapshot.exists()) {
        console.log('Keys found in Firebase for user:', login);
        const data = snapshot.val();
        keyPair = {
          privateKey: ec.keyFromPrivate(data.privateKey, 'hex'),
          publicKey: data.publicKey, // публічний ключ для шифрування
        };
      } else {
        console.log('No keys found in Firebase, generating new keys...');
        const newKeyPair = ec.genKeyPair();
        keyPair = {
          privateKey: newKeyPair.getPrivate('hex'),
          publicKey: newKeyPair.getPublic('hex'),
        };
        // Зберегти пару ключів у Firebase
        await set(userRef, keyPair);
      }

      setUserKeys({ ...userKeys, [login]: { keyPair } });
      setCurrentUser(login);
    } else {
      alert('Невірний логін або пароль');
    }
  };

  const handleMessageChange = (event) => {
    setMessage(event.target.value);
  };

  const encryptMessage = (recipient) => {
    const sender = currentUser;
    console.log('Encrypting message for recipient:', recipient);

    if (!userKeys[sender] || !userKeys[recipient]) {
      alert('Неможливо знайти ключі для користувачів');
      console.error('Missing keys for sender or recipient', { sender, recipient });
      return;
    }

    const senderKeyPair = userKeys[sender].keyPair;
    const recipientPublicKey = ec.keyFromPublic(userKeys[recipient].keyPair.publicKey, 'hex');

    console.log('Sender KeyPair:', senderKeyPair);
    console.log('Recipient Public Key:', recipientPublicKey);

    const sharedSecret = senderKeyPair.derive(recipientPublicKey.getPublic());
    const sharedSecretHex = sharedSecret.toString(16);
    console.log('Shared secret (hex):', sharedSecretHex);

    const encrypted = CryptoJS.AES.encrypt(message, sharedSecretHex).toString();
    return encrypted;
  };

  const decryptMessage = (encryptedMessage, sender) => {
    const recipient = currentUser;
    console.log('Decrypting message from sender:', sender);

    if (!userKeys[recipient] || !userKeys[sender]) {
      alert('Неможливо знайти ключі для користувачів');
      console.error('Missing keys for recipient or sender', { recipient, sender });
      return 'Помилка при дешифруванні';
    }

    const recipientKeyPair = userKeys[recipient].keyPair;
    const senderPublicKey = ec.keyFromPublic(userKeys[sender].keyPair.publicKey, 'hex');

    console.log('Recipient KeyPair:', recipientKeyPair);
    console.log('Sender Public Key:', senderPublicKey);

    const sharedSecret = recipientKeyPair.derive(senderPublicKey.getPublic());
    const sharedSecretHex = sharedSecret.toString(16);
    console.log('Shared secret (hex) for decryption:', sharedSecretHex);

    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, sharedSecretHex).toString(CryptoJS.enc.Utf8);
    return decrypted || 'Помилка при дешифруванні';
  };

  const sendMessage = async () => {
    if (!message) return;

    // Отримання ключів для відправника та отримувача з Firebase
    const recipientKeyRef = ref(db, `users/${recipient}`);
    const recipientSnapshot = await get(recipientKeyRef);

    if (recipientSnapshot.exists()) {
      setUserKeys({ ...userKeys, [recipient]: { keyPair: recipientSnapshot.val() } });
    } else {
      alert('Неможливо знайти ключ отримувача');
      return;
    }

    const encrypted = encryptMessage(recipient);
    if (!encrypted) return;

    const newMsg = {
      sender: currentUser,
      recipient: recipient,
      message: encrypted,
      encrypted: true,
    };

    const messagesRef = ref(db, 'messages/' + Date.now());
    await set(messagesRef, newMsg);

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

export default App
