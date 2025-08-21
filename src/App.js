// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import { issueDidKey } from './services/didKey';
import { issueDidEthr } from './services/didEthr';
import { universalResolve } from './services/resolver';
// VCの保存・取得
import { saveVc, getStoredVcs } from './services/didKey';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IdIssueScreen = () => {
  const [method, setMethod] = React.useState('key'); // 'key' | 'ethr'
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (!val) setError('メールアドレスを入力してください');
    else if (!emailRegex.test(val)) setError('正しいメールアドレスを入力してください');
    else setError('');
  };

  const handleIssue = async () => {
    if (error || !email) {
      alert('正しいメールアドレスを入力してください');
      return;
    }
    try {
      let data;
      if (method === 'key') data = issueDidKey();
      else data = issueDidEthr();
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
        <input type="email" value={email} onChange={handleEmailChange} placeholder="example@domain.com" style={{width: '250px'}} />
        {error && <p style={{color:'red', margin: '4px 0 0 0'}}>{error}</p>}
      </div>
      <div style={{marginBottom: 12}}>
        <label>方式: </label>
        <select value={method} onChange={e => setMethod(e.target.value)}>
          <option value="key">did:key (Ed25519)</option>
          <option value="ethr">did:ethr ({'sepolia'})</option>
        </select>
      </div>
      <button onClick={handleIssue} disabled={!!error || !email}>DIDを発行する</button>
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
    if (!did) {
      alert('DIDが入力されていません');
      return;
    }
    navigate('/display-vc', { state: { did } });
  };

  return (
    <div>
      <h2>ID表示画面</h2>
      {issued && <p>発行されたメールアドレス: {issued.email}</p>}
      <p>ここでDID Documentを解決し、表示します。</p>
      <input value={did} onChange={e => setDid(e.target.value)} placeholder="did:key:... もしくは did:ethr:..." style={{width:'80%'}} />
      <div>
        <button onClick={handleResolve}>DIDを解決して表示</button>
      </div>
      {doc && <pre>{JSON.stringify(doc, null, 2)}</pre>}
      {err && <p style={{color:'red'}}>エラー: {err}</p>}
      {issued && <p>発行されたDID: {issued.did}</p>}
      <div style={{marginTop: '16px'}}>
        <button onClick={goVcDisplay} style={{padding: '8px 16px', fontSize: '16px'}}>VC表示</button>
      </div>
    </div>
  );
};

const VcDisplayScreen = () => {
  const location = useLocation();
  const didFromState = location.state?.did || '';
  const [didFilter, setDidFilter] = React.useState(didFromState);
  const [vcs, setVcs] = React.useState([]);

  // didFilter変更時に自動ロード
  React.useEffect(() => {
    const all = getStoredVcs();
    const list = didFilter ? all.filter(v => v.holderDid === didFilter) : all;
    setVcs(list);
  }, [didFilter]);

  const addDummyVc = () => {
    const newVc = {
      id: 'urn:uuid:' + (crypto?.randomUUID ? crypto.randomUUID() : Date.now()),
      name: 'デモVC',
      issuer: didFilter || 'did:example:issuerDummy',
      holderDid: didFilter || 'did:example:holderDummy',
      issuanceDate: new Date().toISOString()
    };
    saveVc(newVc);
    setVcs(prev => [...prev, newVc]);
  };

  const card = {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
    border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  };

  const badge = { width: 48, height: 48, borderRadius: 9999, background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 };

  return (
    <div>
      <h2>VC一覧画面</h2>
      <div style={{marginBottom: 12}}>
        <label>DIDフィルタ: </label>
        <input style={{width:'80%'}} placeholder="did:key:...（空なら全件表示）" value={didFilter} onChange={e => setDidFilter(e.target.value)} />
      </div>
      <div style={{margin: '12px 0'}}>
        <button onClick={addDummyVc}>ダミーVCを追加</button>
      </div>
      {vcs.length === 0 ? (
        <p>保存されたVCはありません。</p>
      ) : (
        <div style={{display:'grid', gap: 12}}>
          {vcs.map((vc, i) => (
            <div key={vc.id || i} style={card}>
              <div style={badge}>VC</div>
              <div>
                <div style={{fontSize:16, fontWeight:600}}>{vc.name || 'Verifiable Credential'}</div>
                <div style={{fontSize:12, color:'#6b7280'}}>Issuer: {vc.issuer || '不明'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
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
