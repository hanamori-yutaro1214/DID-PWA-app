// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import './App.css';

import { issueDidKey } from './services/didKey';
import { issueDidEthr } from './services/didEthr';
import { universalResolve } from './services/resolver';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// VCの保存・取得関数
function saveVcsForDid(did, vcs) {
  const allVcs = JSON.parse(localStorage.getItem("vcsByDid") || "{}");
  allVcs[did] = vcs;
  localStorage.setItem("vcsByDid", JSON.stringify(allVcs));
}

function getVcsByDid(did) {
  const allVcs = JSON.parse(localStorage.getItem("vcsByDid") || "{}");
  return allVcs[did] || [];
}

// ダミーVCを生成（DIDごとに個数・内容が変わる）
function generateDummyVcs(did, email) {
  const lastChar = did.slice(-1);
  const numVcs = parseInt(lastChar, 36) % 3 + 1; // 1~3個
  const vcs = [];

  if (numVcs >= 1) {
    vcs.push({
      id: `http://example.edu/credentials/${did}-1`,
      type: ["VerifiableCredential", "EmailCredential"],
      credentialSubject: { id: did, email: email },
      issuer: did,
      issuanceDate: "2023-01-01T00:00:00Z",
    });
  }
  if (numVcs >= 2) {
    vcs.push({
      id: `http://example.edu/credentials/${did}-2`,
      type: ["VerifiableCredential", "ProfileCredential"],
      credentialSubject: { id: did, name: `User ${did}` },
      issuer: did,
      issuanceDate: "2023-02-01T00:00:00Z",
    });
  }
  if (numVcs >= 3) {
    vcs.push({
      id: `http://example.edu/credentials/${did}-3`,
      type: ["VerifiableCredential", "MembershipCredential"],
      credentialSubject: { id: did, membership: "Premium Plan" },
      issuer: did,
      issuanceDate: "2023-03-01T00:00:00Z",
    });
  }

  return vcs;
}

const IdIssueScreen = () => {
  const [method, setMethod] = React.useState('key');
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
      const dummyVcs = generateDummyVcs(issued.did, email);
      saveVcsForDid(issued.did, dummyVcs);

      navigate('/display-id', { state: { issued } });
    } catch (e) {
      alert(`発行に失敗: ${e.message}`);
    }
  };

  return (
    <div>
      <h2>ID発行画面</h2>

      {/* メールアドレス入力 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ whiteSpace: 'nowrap' }}>メールアドレス:</label>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="example@domain.com"
          style={{ flex: 1, maxWidth: '300px', boxSizing: 'border-box' }}
        />
      </div>
      {error && <p style={{ color: 'red', margin: '4px 0 12px 0' }}>{error}</p>}

      {/* DID方式選択 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ whiteSpace: 'nowrap' }}>方式:</label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value)}
          style={{ flex: 1, maxWidth: '250px', boxSizing: 'border-box' }}
        >
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
    navigate('/display-vc', { state: { did } });
  };

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <h2>ID表示画面</h2>

      {issued && <p>メールアドレス: {issued.email}</p>}

      <p>DID Documentを解決し、表示します。</p>
      <input
        value={did}
        onChange={e => setDid(e.target.value)}
        placeholder="did:key:... もしくは did:ethr:..."
        style={{ width: '100%', maxWidth: '400px', boxSizing: 'border-box' }} // ←修正前のように適度なサイズ
      />
      <div style={{ marginTop: '8px' }}>
        <button onClick={handleResolve}>DIDのドキュメントを表示</button>
      </div>

      {doc && (
        <pre style={{
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowX: 'auto',
          maxWidth: '100%'
        }}>
          {JSON.stringify(doc, null, 2)}
        </pre>
      )}
      {err && <p style={{ color: 'red' }}>エラー: {err}</p>}

      {issued && (
        <p style={{
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          maxWidth: '100%'
        }}>
          発行されたDID: {issued.did}
        </p>
      )}

      <div style={{ marginTop: '16px' }}>
        <button onClick={goVcDisplay} style={{ padding: '8px 16px', fontSize: '16px' }}>
          VC表示
        </button>
      </div>
    </div>
  );
};

const VcDisplayScreen = () => {
  const location = useLocation();
  const did = location.state?.did || "did:example:default";
  const [vcs, setVcs] = React.useState([]);

  React.useEffect(() => {
    const vcsForDid = getVcsByDid(did);
    setVcs(vcsForDid);
  }, [did]);

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <h2>VC表示画面</h2>
      <p style={{ wordWrap: 'break-word' }}>{did} に紐づくVCを複数表示します。</p>

      {vcs.length === 0 && <p>VCは存在しません。</p>}

      {vcs.map((vc, idx) => (
        <div
          key={idx}
          style={{
            border: '1px solid #ccc',
            padding: '8px',
            marginBottom: '12px',
            wordWrap: 'break-word',
            overflowX: 'auto',
            maxWidth: '100%'
          }}
        >
          <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            {JSON.stringify(vc, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <div className="App" style={{ padding: '16px', maxWidth: '900px', margin: '0 auto', overflowX: 'hidden' }}>
        <header className="App-header">
          <h1>DID PWA アプリ</h1>
          <nav>
            <ul style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: 0, listStyle: 'none' }}>
              <li><Link to="/">ID発行</Link></li>
              <li><Link to="/display-id">ID表示</Link></li>
              <li><Link to="/display-vc">VC表示</Link></li>
            </ul>
          </nav>
        </header>
        <main style={{ width: '100%' }}>
          <Routes>
            <Route path="/" element={<IdIssueScreen />} />
            <Route path="/display-id" element={<IdDisplayScreen />} />
            <Route path="/display-vc" element={<VcDisplayScreen />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
