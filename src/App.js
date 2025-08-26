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

// DID履歴の保存・取得（メールごと）
function saveDidHistory(email, issued) {
  const historyByEmail = JSON.parse(localStorage.getItem("didHistoryByEmail") || "{}");
  if (!historyByEmail[email]) {
    historyByEmail[email] = [];
  }
  historyByEmail[email].push(issued);
  localStorage.setItem("didHistoryByEmail", JSON.stringify(historyByEmail));
}

function getDidHistoryByEmail(email) {
  const historyByEmail = JSON.parse(localStorage.getItem("didHistoryByEmail") || "{}");
  return historyByEmail[email] || [];
}

// ------------------ VCテンプレート定義 ------------------
const vcTemplates = [
  {
    type: ["VerifiableCredential", "EmailCredential"],
    subject: (did, email) => ({ id: did, email }),
    issuanceDate: "2023-01-01T00:00:00Z",
  },
  {
    type: ["VerifiableCredential", "ProfileCredential"],
    subject: (did) => ({ id: did, name: `User ${did}` }),
    issuanceDate: "2023-02-01T00:00:00Z",
  },
  {
    type: ["VerifiableCredential", "MembershipCredential"],
    subject: (did) => ({ id: did, membership: "Premium Plan" }),
    issuanceDate: "2023-03-01T00:00:00Z",
  },
];

// ダミーVCを生成（汎用化）
function generateDummyVcs(did, email) {
  const lastChar = did.slice(-1);
  const numVcs = parseInt(lastChar, 36) % vcTemplates.length + 1;

  return vcTemplates.slice(0, numVcs).map((tpl, idx) => ({
    id: `http://example.edu/credentials/${did}-${idx + 1}`,
    type: tpl.type,
    credentialSubject: tpl.subject(did, email),
    issuer: did,
    issuanceDate: tpl.issuanceDate,
  }));
}

// ------------------ Helper: DID折り返し表示 ------------------
function BreakableDid({ did, chunkSize = 25 }) {
  return (
    <>
      {did.match(new RegExp(`.{1,${chunkSize}}`, 'g')).map((chunk, i) => (
        <React.Fragment key={i}>
          {chunk}<br />
        </React.Fragment>
      ))}
    </>
  );
}

// ------------------ ID発行画面 ------------------
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

      // VC保存
      const dummyVcs = generateDummyVcs(issued.did, email);
      saveVcsForDid(issued.did, dummyVcs);

      // DID履歴保存（メールごと）
      saveDidHistory(email, issued);

      navigate('/display-id', { state: { issued } });
    } catch (e) {
      alert(`発行に失敗: ${e.message}`);
    }
  };

  return (
    <div>
      <h2>DID発行</h2>
      <div style={{ marginBottom: 12 }}>
        <label>メールアドレス: </label>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="example@domain.com"
          style={{ width: '238px' }}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
      <div style={{ marginBottom: 12 }}>
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

// ------------------ ID表示画面 ------------------
const IdDisplayScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const issued = location.state?.issued;
  const [did, setDid] = React.useState(issued?.did || '');
  const [doc, setDoc] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [history, setHistory] = React.useState([]);

  React.useEffect(() => {
    if (issued?.email) {
      setHistory(getDidHistoryByEmail(issued.email));
    }
  }, [issued]);

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
    const targetEmail = issued?.email || ''; 
    navigate('/display-vc', { state: { email: targetEmail, inputDid: did } });
  };

  return (
    <div>
      <h2>ID表示画面</h2>
      {issued && <p>メールアドレス: {issued.email}</p>}
      <p>DID Documentを解決して、表示します。</p>
      <input
        value={did}
        onChange={e => setDid(e.target.value)}
        placeholder="did:key:... もしくは did:ethr:..."
        style={{ width: '60%' }}
      />
      <div>
        <button onClick={handleResolve}>DIDのドキュメントを表示</button>
      </div>
      {doc && <pre>{JSON.stringify(doc, null, 2)}</pre>}
      {err && <p style={{ color: 'red' }}>エラー: {err}</p>}
      {issued && (
        <p>
          発行されたDID: <BreakableDid did={issued.did} />
        </p>
      )}

      <h3>DID一覧（同じメールアドレスのみ）</h3>
      <ul>
        {history.map((item, idx) => (
          <li key={idx}><BreakableDid did={item.did} /></li>
        ))}
      </ul>

      <div style={{ marginTop: '16px' }}>
        <button onClick={goVcDisplay}>VC表示</button>
      </div>
    </div>
  );
};

// ------------------ VC表示画面 ------------------
const VcDisplayScreen = () => {
  const location = useLocation();
  const email = location.state?.email;
  const inputDid = location.state?.inputDid;
  const [allVcs, setAllVcs] = React.useState([]);

  React.useEffect(() => {
    if (!email && !inputDid) return;

    const aggregated = [];

    if (inputDid) {
      const vcsForInput = getVcsByDid(inputDid);
      vcsForInput.forEach(vc => aggregated.push({ did: inputDid, vc }));
    }

    if (email) {
      const history = getDidHistoryByEmail(email);
      history.forEach(item => {
        if (item.did !== inputDid) {
          const vcs = getVcsByDid(item.did);
          vcs.forEach(vc => aggregated.push({ did: item.did, vc }));
        }
      });
    }

    setAllVcs(aggregated);
  }, [email, inputDid]);

  if (!email && !inputDid) {
    return <p>対象のDIDまたはメールアドレスが指定されていません。</p>;
  }

  return (
    <div>
      <h2>VC一覧</h2>
      <p>入力されたDIDおよびメールアドレスに紐づくすべてのDIDのVCを表示します。</p>
      {allVcs.length === 0 && <p>VCは存在しません。</p>}
      {allVcs.map((item, idx) => (
        <div key={idx} style={{ border: '1px solid #ccc', padding: '8px', marginBottom: '12px' }}>
          <p>
            <strong>DID: <BreakableDid did={item.did} /></strong>
          </p>
          <pre>{JSON.stringify(item.vc, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
};

// ------------------ ルーティング ------------------
export default function App() {
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
            <Route path="/" element={<IdIssueScreen />} />
            <Route path="/display-id" element={<IdDisplayScreen />} />
            <Route path="/display-vc" element={<VcDisplayScreen />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
