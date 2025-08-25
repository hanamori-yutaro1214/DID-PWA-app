// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import './App.css';

import { issueDidKey } from './services/didKey';
import { issueDidEthr } from './services/didEthr';
import { universalResolve } from './services/resolver';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IdIssueScreen = () => {
  const [method, setMethod] = React.useState('key'); // 'key' | 'ethr'
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);

    if (!val) {
      setError('メールアドレスを入力してください');
    } else if (!emailRegex.test(val)) {
      setError('正しいメールアドレスを入力してください');
    } else {
      setError('');
    }
  };

  const handleIssue = async () => {
    if (error || !email) {
      alert('正しいメールアドレスを入力してください');
      return;
    }

    try {
      let data;
      if (method === 'key') {
        data = issueDidKey();
      } else {
        data = issueDidEthr();
      }

      const issued = { ...data, email };
      navigate('/display-id', { state: { issued } });

    } catch (e) {
      alert(`発行に失敗: ${e.message}`);
    }
  };

  return (
    <div>
      <h2>ID発行画面</h2>

      <div style={{marginBottom: 12}}>
        <label>メールアドレス: </label>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="example@domain.com"
          style={{width: '250px'}}
        />
        {error && <p style={{color:'red', margin: '4px 0 0 0'}}>{error}</p>}
      </div>

      <div style={{marginBottom: 12}}>
        <label>方式: </label>
        <select value={method} onChange={e => setMethod(e.target.value)}>
          <option value="key">did:key (Ed25519)</option>
          <option value="ethr">did:ethr (sepolia)</option>
        </select>
      </div>

      <button onClick={handleIssue} disabled={!!error || !email}>
        DIDを発行する
      </button>
    </div>
  );
};

const IdDisplayScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const issued = location.state?.issued;
  const [did, setDid] = React.useState(issued?.did || '');
  const [doc, setDoc] = React.useState(null);
  const [err, setErr] = React.useState(null);

  const handleResolve = async () => {
    try {
      setErr(null);
      const d = await universalResolve(did.trim());
      setDoc(d);
    } catch (e) {
      setDoc(null);
      setErr(e.message);
    }
  };

  const goVcDisplay = () => {
    navigate('/display-vc', { state: { did } }); // ← DID を渡す
  };

  return (
    <div>
      <h2>ID表示画面</h2>

      {issued && <p>発行されたメールアドレス: {issued.email}</p>}

      <p>ここでDID Documentを解決し、表示します。</p>
      <input
        value={did}
        onChange={e => setDid(e.target.value)}
        placeholder="did:key:... もしくは did:ethr:..."
        style={{width:'80%'}}
      />
      <div>
        <button onClick={handleResolve}>DIDを解決して表示</button>
      </div>

      {doc && <pre>{JSON.stringify(doc, null, 2)}</pre>}
      {err && <p style={{color:'red'}}>エラー: {err}</p>}

      {issued && <p>発行されたDID: {issued.did}</p>}

      {/* VC表示ボタン */}
      <div style={{marginTop: '16px'}}>
        <button onClick={goVcDisplay} style={{padding: '8px 16px', fontSize: '16px'}}>
          VC表示
        </button>
      </div>
    </div>
  );
};

const VcDisplayScreen = () => {
  const location = useLocation();
  const did = location.state?.did || "did:example:default";

  // 複数ダミーVCを生成
  const dummyVcs = [
    {
      id: "http://example.edu/credentials/1",
      type: ["VerifiableCredential","EmailCredential"],
      credentialSubject: { id: did, email: "user@example.com" },
      issuer: did,
      issuanceDate: "2023-01-01T00:00:00Z"
    },
    {
      id: "http://example.edu/credentials/2",
      type: ["VerifiableCredential","ProfileCredential"],
      credentialSubject: { id: did, name: "Taro Yamada" },
      issuer: did,
      issuanceDate: "2023-02-01T00:00:00Z"
    },
    {
      id: "http://example.edu/credentials/3",
      type: ["VerifiableCredential","MembershipCredential"],
      credentialSubject: { id: did, membership: "Premium Plan" },
      issuer: did,
      issuanceDate: "2023-03-01T00:00:00Z"
    }
  ];

  return (
    <div>
      <h2>VC表示画面</h2>
      <p>このDIDに紐づくVCを複数表示します。</p>

      {dummyVcs.map((vc, idx) => (
        <div key={idx} style={{border:'1px solid #ccc', padding:'8px', marginBottom:'12px'}}>
          <pre>{JSON.stringify(vc, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
};

export default function App(){
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>DID PWA アプリ</h1>
          <nav>
            <ul>
              <li><Link to="/">ID発行</Link></li>
              <li><Link to="/display-id">ID表示</Link></li>
              <li><Link to="/display-vc">VC表示</Link></li>
            </ul>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<IdIssueScreen/>}/>
            <Route path="/display-id" element={<IdDisplayScreen/>}/>
            <Route path="/display-vc" element={<VcDisplayScreen/>}/>
          </Routes>
        </main>
      </div>
    </Router>
  );
}
