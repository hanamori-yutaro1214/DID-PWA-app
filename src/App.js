// src/App.js
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
  Navigate
} from 'react-router-dom';
import './App.css';

import { issueDidKey } from './services/didKey';
import { issueDidEthr } from './services/didEthr';
import { universalResolve } from './services/resolver';

// Firestore helpers (your cloud.js)
import {
  saveDid as cloudSaveDid,
  saveDidHistory as cloudSaveDidHistory,
  getAllUsers as cloudGetAllUsers,
  getVcsByDid as cloudGetVcsByDid,
  appendVcForDid as cloudAppendVcForDid
} from './services/cloud';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ================== 設定（簡易管理者） ==================
const ADMIN_PASSWORD = 'caica1214';
const ADMIN_ISSUER_DID = 'CAICAテクノロジーズ';

// ================== LocalStorage ユーティリティ（既存を残す） ==================
function saveVcsForDidLocal(did, vcs) {
  const allVcs = JSON.parse(localStorage.getItem('vcsByDid') || '{}');
  allVcs[did] = vcs;
  localStorage.setItem('vcsByDid', JSON.stringify(allVcs));
}
function getVcsByDidLocal(did) {
  const allVcs = JSON.parse(localStorage.getItem('vcsByDid') || '{}');
  return allVcs[did] || [];
}
function appendVcForDidLocal(did, vc) {
  const cur = getVcsByDidLocal(did);
  cur.push(vc);
  saveVcsForDidLocal(did, cur);
}
function saveDidHistoryLocal(email, issued) {
  const historyByEmail = JSON.parse(localStorage.getItem('didHistoryByEmail') || '{}');
  if (!historyByEmail[email]) historyByEmail[email] = [];
  historyByEmail[email].push(issued);
  localStorage.setItem('didHistoryByEmail', JSON.stringify(historyByEmail));
}
function getDidHistoryByEmailLocal(email) {
  const historyByEmail = JSON.parse(localStorage.getItem('didHistoryByEmail') || '{}');
  return historyByEmail[email] || [];
}
function getAllDidsFromHistoryLocal() {
  const historyByEmail = JSON.parse(localStorage.getItem('didHistoryByEmail') || '{}');
  const list = [];
  Object.entries(historyByEmail).forEach(([email, arr]) => {
    (arr || []).forEach((issued) => {
      list.push({ email, did: issued.did, method: issued.method });
    });
  });
  const seen = new Set();
  return list.filter((x) => (seen.has(x.did) ? false : (seen.add(x.did), true)));
}

// ---- lastContext の管理 ----
function setLastContext({ email, did }) {
  localStorage.setItem('lastContext', JSON.stringify({ email, did }));
}
function getLastContext() {
  return JSON.parse(localStorage.getItem('lastContext') || '{}');
}

// ---- 管理者ログイン状態 ----
function setAdminLoggedIn(flag) {
  localStorage.setItem('isAdmin', flag ? 'true' : 'false');
}
function isAdmin() {
  return localStorage.getItem('isAdmin') === 'true';
}

// ---- VCテンプレート保存 ----
function saveVcTemplate(tpl) {
  const arr = JSON.parse(localStorage.getItem('vcTemplates') || '[]');
  arr.push(tpl);
  localStorage.setItem('vcTemplates', JSON.stringify(arr));
}
function getVcTemplates() {
  return JSON.parse(localStorage.getItem('vcTemplates') || '[]');
}
function deleteVcTemplate(id) {
  const arr = getVcTemplates().filter((t) => t.id !== id);
  localStorage.setItem('vcTemplates', JSON.stringify(arr));
}

// ================== ユーティリティ ==================
function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ================== DID表示折り返し ==================
function BreakableDid({ did, chunkSize = 25 }) {
  if (!did) return null;
  const chunks = did.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [did];
  return (
    <>
      {chunks.map((chunk,i)=>(<React.Fragment key={i}>{chunk}<br/></React.Fragment>))}
    </>
  );
}

// ================== Firestore <-> Local wrappers ==================
async function getAllDidsFromHistoryMerged() {
  try {
    const users = await cloudGetAllUsers(); 
    const list = [];
    users.forEach(u => {
      if (u.didHistory && Array.isArray(u.didHistory)) {
        (u.didHistory || []).forEach((issued) => {
          const didVal = typeof issued === 'string' ? issued : (issued.did || '');
          if (didVal) list.push({ email: u.email, did: didVal, method: issued?.method || '' });
        });
      }
      if (u.did) {
        const didVal = typeof u.did === 'string' ? u.did : (u.did.did || '');
        if (didVal) list.push({ email: u.email, did: didVal, method: '' });
      }
    });
    const local = getAllDidsFromHistoryLocal();
    local.forEach(x => list.push(x));
    const seen = new Set();
    return list.filter(x => (seen.has(x.did) ? false : (seen.add(x.did), true)));
  } catch (e) {
    console.warn('getAllDidsFromHistoryMerged: cloud fetch failed', e);
    return getAllDidsFromHistoryLocal();
  }
}

async function getVcsByDidMerged(did) {
  try {
    let vcs = await cloudGetVcsByDid(did);
    // 🔹 取得した値を必ず配列に正規化
    if (!Array.isArray(vcs)) {
      if (vcs && vcs.vc) {
        vcs = Array.isArray(vcs.vc) ? vcs.vc : [vcs.vc];
      } else {
        vcs = [];
      }
    }
    if (vcs.length > 0) return vcs;
    return getVcsByDidLocal(did);
  } catch (e) {
    console.warn('getVcsByDidMerged: cloud fetch failed', e);
    return getVcsByDidLocal(did);
  }
}

async function appendVcForDidMerged(did, vc) {
  try {
    await cloudAppendVcForDid(did, vc);
    appendVcForDidLocal(did, vc);
  } catch (e) {
    console.warn('appendVcForDidMerged failed', e);
    appendVcForDidLocal(did, vc);
    throw e;
  }
}

// ================== 画面コンポーネント ==================

// --- DID発行 ---
const IdIssueScreen = () => {
  const [method,setMethod] = React.useState('key');
  const [email,setEmail] = React.useState('');
  const [error,setError] = React.useState('');
  const navigate = useNavigate();

  const handleIssue = async()=>{
    if(error||!email){ alert('正しいメールアドレスを入力してください'); return; }
    try{
      const data = method==='key'? issueDidKey():issueDidEthr();
      const issued = {...data,email};
      saveDidHistoryLocal(email, issued);
      try {
        await cloudSaveDid(email, issued.did || issued);
        await cloudSaveDidHistory(email, issued);
      } catch (e) { console.warn('cloud save failed', e); }
      setLastContext({email,did:issued.did});
      navigate('/display-id',{state:{issued}});
    }catch(e){ alert(`発行に失敗: ${e.message || e}`); }
  };

  return (
    <div>
      <h2>DID発行</h2>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <button onClick={handleIssue}>DIDを発行する</button>
    </div>
  );
};

// --- DID表示 ---
const IdDisplayScreen = () => {
  const location = useLocation();
  const issued = location.state?.issued;
  const [did,setDid] = React.useState(issued?.did||'');
  return (
    <div>
      <h2>DID表示</h2>
      {issued && <p>発行されたDID: <BreakableDid did={issued.did}/></p>}
      <input value={did} onChange={e=>setDid(e.target.value)} />
    </div>
  );
};

// --- VC表示 ---
const VcDisplayScreen = () => {
  const location = useLocation();
  let { inputDid } = location.state || {};
  const [currentDid, setCurrentDid] = React.useState(() => {
    if (inputDid) return inputDid;
    try {
      if (sessionStorage.getItem('vcContextValid') === 'true') {
        const lc = getLastContext();
        return lc.did || '';
      }
    } catch (e) {}
    return '';
  });

  const [allVcs,setAllVcs] = React.useState([]);

  React.useEffect(() => {
    sessionStorage.removeItem('vcContextValid');
    const fetchVcs = async () => {
      if (!currentDid) {
        setAllVcs([]);
        return;
      }
      try {
        let vcs = await getVcsByDidMerged(currentDid);
        setAllVcs((vcs || []).map(vc => ({ did: currentDid, vc })));
      } catch (e) {
        console.error('getVcsByDid error', e);
        setAllVcs([]);
      }
    };
    fetchVcs();
  }, [currentDid, inputDid]);

  if (!currentDid) return <p>VCは存在しません。</p>;

  return (
    <div>
      <h2>VC一覧</h2>
      {allVcs.length===0 && <p>VCは存在しません。</p>}
      {allVcs.map((item,idx)=>
        <div key={idx}>
          <pre>{JSON.stringify(item.vc,null,2)}</pre>
        </div>
      )}
    </div>
  );
};

// --- 管理者ログイン ---
const AdminLoginScreen = ({onLogin})=>{
  const [pw,setPw] = React.useState('');
  const navigate = useNavigate();
  const handleLogin = ()=>{
    if(pw===ADMIN_PASSWORD){
      setAdminLoggedIn(true); onLogin(true); navigate('/issue-vc');
    }else{ alert('パスワードが違います'); }
  };
  return (
    <div>
      <h2>管理者ログイン</h2>
      <input type="password" value={pw} onChange={e=>setPw(e.target.value)}/>
      <button onClick={handleLogin}>ログイン</button>
    </div>
  );
};

// --- VC付与 ---
const VcAssignScreen = () => {
  const [didList,setDidList] = React.useState([]);
  const [templates,setTemplates] = React.useState(getVcTemplates());
  const [selectedDid,setSelectedDid] = React.useState('');
  const [selectedTplId,setSelectedTplId] = React.useState('');

  React.useEffect(()=>{
    const fetchDids = async ()=>{
      try { setDidList(await getAllDidsFromHistoryMerged()); }
      catch(e){ setDidList(getAllDidsFromHistoryLocal()); }
    };
    fetchDids();
  },[]);

  const handleAssign = async ()=>{
    if(!selectedDid || !selectedTplId){ alert('選択してください'); return; }
    const tpl = templates.find(t=>t.id===selectedTplId);
    const vc = { id:`vc-${Date.now()}`, type:tpl.type, issuer:tpl.issuer, holder:selectedDid, credentialSubject:{id:selectedDid,title:tpl.name}};
    try {
      await appendVcForDidMerged(selectedDid, vc);
      alert('VCを付与しました（Firestore とローカルに保存）');
    } catch (e) { alert('VC付与に失敗しました'); }
  };

  return (
    <div>
      <h2>VC付与</h2>
      <select value={selectedDid} onChange={e=>setSelectedDid(e.target.value)}>
        <option value="">選択してください</option>
        {didList.map(x=><option key={x.did} value={x.did}>{x.did}</option>)}
      </select>
      <select value={selectedTplId} onChange={e=>setSelectedTplId(e.target.value)}>
        <option value="">テンプレートを選択</option>
        {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button onClick={handleAssign}>VC付与</button>
    </div>
  );
};

// --- 管理者専用ルートガード ---
const AdminRoute = ({ element })=> isAdmin()? element : <Navigate to="/admin-login" replace />;

// ================== ルーティング ==================
export default function App(){
  const [admin,setAdmin] = React.useState(isAdmin());
  return (
    <Router>
      <div className="App">
        <h1>DIDアプリ</h1>
        <Routes>
          <Route path="/" element={<IdIssueScreen />} />
          <Route path="/display-id" element={<IdDisplayScreen />} />
          <Route path="/display-vc" element={<VcDisplayScreen />} />
          <Route path="/admin-login" element={<AdminLoginScreen onLogin={setAdmin}/>} />
          <Route path="/assign-vc" element={<AdminRoute element={<VcAssignScreen />} />} />
        </Routes>
        <nav>
          <Link to="/">ID発行</Link>
          <Link to="/display-id">ID表示</Link>
          <Link to="/display-vc">VC表示</Link>
          {admin && <Link to="/assign-vc">VC付与</Link>}
        </nav>
      </div>
    </Router>
  );
}
