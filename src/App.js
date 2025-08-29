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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ================== 設定（簡易管理者） ==================
const ADMIN_PASSWORD = 'caica1214';
const ADMIN_ISSUER_DID = 'CAICAテクノロジーズ';

// ================== LocalStorage ユーティリティ ==================
function saveVcsForDid(did, vcs) {
  const allVcs = JSON.parse(localStorage.getItem('vcsByDid') || '{}');
  allVcs[did] = vcs;
  localStorage.setItem('vcsByDid', JSON.stringify(allVcs));
}
function getVcsByDid(did) {
  const allVcs = JSON.parse(localStorage.getItem('vcsByDid') || '{}');
  return allVcs[did] || [];
}
function appendVcForDid(did, vc) {
  const cur = getVcsByDid(did);
  cur.push(vc);
  saveVcsForDid(did, cur);
}
function saveDidHistory(email, issued) {
  const historyByEmail = JSON.parse(localStorage.getItem('didHistoryByEmail') || '{}');
  if (!historyByEmail[email]) historyByEmail[email] = [];
  historyByEmail[email].push(issued);
  localStorage.setItem('didHistoryByEmail', JSON.stringify(historyByEmail));
}
function getDidHistoryByEmail(email) {
  const historyByEmail = JSON.parse(localStorage.getItem('didHistoryByEmail') || '{}');
  return historyByEmail[email] || [];
}
function getAllDidsFromHistory() {
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
      {chunks.map((chunk,i)=>(
        <React.Fragment key={i}>{chunk}<br/></React.Fragment>
      ))}
    </>
  );
}

// ================== 画面コンポーネント ==================
const IdIssueScreen = () => {
  const [method,setMethod] = React.useState('key');
  const [email,setEmail] = React.useState('');
  const [error,setError] = React.useState('');
  const navigate = useNavigate();

  const handleEmailChange = (e)=>{
    const val = e.target.value;
    setEmail(val);
    if(!val) setError('メールアドレスを入力してください');
    else if(!emailRegex.test(val)) setError('正しいメールアドレスを入力してください');
    else setError('');
  };

  const handleIssue = async()=>{
    if(error||!email){ alert('正しいメールアドレスを入力してください'); return; }
    try{
      const data = method==='key'? issueDidKey():issueDidEthr();
      const issued = {...data,email};

      // --- ダミーVCの自動保存は削除しました ---
      // DID履歴保存
      saveDidHistory(email,issued);

      // lastContext更新
      setLastContext({email,did:issued.did});

      navigate('/display-id',{state:{issued}});
    }catch(e){ alert(`発行に失敗: ${e.message}`); }
  };

  return (
    <div>
      <h2>DID発行</h2>
      <div style={{marginBottom:12}}>
        <label>メールアドレス: </label>
        <input type="email" value={email} onChange={handleEmailChange} placeholder="example@domain.com" style={{width:'238px'}}/>
        {error && <p style={{color:'red'}}>{error}</p>}
      </div>
      <div style={{marginBottom:12}}>
        <label>方式: </label>
        <select value={method} onChange={(e)=>setMethod(e.target.value)}>
          <option value="key">did:key (Ed25519)</option>
          <option value="ethr">did:ethr (sepolia)</option>
        </select>
      </div>
      <button onClick={handleIssue} disabled={!!error||!email}>DIDを発行する</button>
    </div>
  );
};

const IdDisplayScreen = () => {
  const location = useLocation();
  const issued = location.state?.issued;
  const [did,setDid] = React.useState(issued?.did||'');
  const [doc,setDoc] = React.useState(null);
  const [err,setErr] = React.useState(null);
  const [history,setHistory] = React.useState([]);

  React.useEffect(()=>{
    if(issued?.email){
      setHistory(getDidHistoryByEmail(issued.email));
      setLastContext({email:issued.email,did:issued.did});
    }
  },[issued]);

  const handleResolve = async()=>{
    try{
      setErr(null);
      const d = await universalResolve(did.trim());
      setDoc(d);
      const ctx = getLastContext();
      setLastContext({email:ctx.email,did});
    }catch(e){ setDoc(null); setErr(e.message);}
  };

  React.useEffect(()=>{
    if(did){ const ctx = getLastContext(); setLastContext({email:ctx.email,did}); }
  },[did]);

  return (
    <div>
      <h2>DID表示</h2>
      {issued && <p>メールアドレス: {issued.email}</p>}
      <input value={did} onChange={(e)=>setDid(e.target.value)} placeholder="did:key:... もしくは did:ethr:..." style={{width:'60%'}}/>
      <div><button onClick={handleResolve}>DIDのドキュメントを表示</button></div>
      {doc && <pre>{JSON.stringify(doc,null,2)}</pre>}
      {err && <p style={{color:'red'}}>エラー: {err}</p>}
      {issued && <p>発行されたDID: <BreakableDid did={issued.did}/></p>}
      <h3>DID一覧（同じメールアドレスのみ）</h3>
      <ul>{history.map((item,idx)=><li key={idx}><BreakableDid did={item.did}/></li>)}</ul>
    </div>
  );
};

const VcDisplayScreen = () => {
  const location = useLocation();
  let { inputDid } = location.state || {};
  const ctx = getLastContext();
  const currentDid = inputDid || ctx.did;
  const [allVcs,setAllVcs] = React.useState([]);

  React.useEffect(()=>{
    if(!currentDid) return;
    const vcsForDid = getVcsByDid(currentDid);
    // ensure array
    setAllVcs((vcsForDid || []).map(vc => ({ did: currentDid, vc })));
  },[currentDid]);

  if(!currentDid) return <p>対象のDIDが指定されていません。</p>;

  return (
    <div>
      <h2>VC一覧</h2>
      {allVcs.length===0 && <p>VCは存在しません。</p>}
      {allVcs.map((item,idx)=> {
        const vc = item.vc || {};
        const subj = vc.credentialSubject || {};
        const title = subj.title || subj.name || "無題の認定証";
        const logo = subj.logo || null;
        let issuance = vc.issuanceDate || vc.issued || vc.issuance || null;
        let issuanceStr = issuance ? (isNaN(new Date(issuance)) ? issuance : new Date(issuance).toLocaleString()) : "不明";
        return (
          <div key={idx} style={{border:'1px solid #ccc',padding:'12px',marginBottom:'16px',borderRadius:8,display:'flex',gap:12,alignItems:'flex-start'}}>
            {/* 左：ロゴ（ある場合） */}
            {logo ? (
              <div style={{flex:'0 0 120px'}}>
                <img src={logo} alt={`logo-${idx}`} style={{maxWidth:120,maxHeight:120,objectFit:'contain',border:'1px solid #eee',padding:6,background:'#fff'}}/>
              </div>
            ) : (
              <div style={{flex:'0 0 120px',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f5',height:120,borderRadius:6}}>
                <small>ロゴなし</small>
              </div>
            )}

            {/* 右：情報 */}
            <div style={{flex:1}}>
              <h3 style={{margin:'4px 0'}}>{title}</h3>
              <p style={{margin:'6px 0'}}><strong>発行者:</strong> {vc.issuer || '不明'}</p>
              <p style={{margin:'6px 0'}}><strong>発行日:</strong> {issuanceStr}</p>
              <p style={{margin:'6px 0'}}><strong>DID:</strong> <BreakableDid did={item.did}/></p>

              {/* 追加メタ情報があれば表示 */}
              {subj.awardedBy && <p style={{margin:'6px 0'}}><strong>授与元:</strong> {subj.awardedBy}</p>}

              {/* 詳細JSON（必要な場合に展開） */}
              <details style={{marginTop:8}}>
                <summary>詳細データ（JSON）を表示</summary>
                <pre style={{fontSize:'0.8em',background:'#f9f9f9',padding:8,overflowX:'auto'}}>{JSON.stringify(vc,null,2)}</pre>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ================== 管理者ログイン ==================
const AdminLoginScreen = ({onLogin})=>{
  const [pw,setPw] = React.useState('');
  const navigate = useNavigate();

  const handleLogin = ()=>{
    if(pw===ADMIN_PASSWORD){
      setAdminLoggedIn(true);
      onLogin(true);
      alert('管理者としてログインしました');
      navigate('/issue-vc');
    }else{ alert('パスワードが違います'); }
  };

  return (
    <div>
      <h2>管理者ログイン</h2>
      <input type="password" value={pw} onChange={(e)=>setPw(e.target.value)} placeholder="管理者パスワード" style={{width:240}}/>
      <div><button onClick={handleLogin} disabled={!pw}>ログイン</button></div>
    </div>
  );
};

// ================== VC発行 ==================
const VcIssueScreen = () => {
  const [name,setName] = React.useState('');
  const [logoDataUrl,setLogoDataUrl] = React.useState('');
  const [templates,setTemplates] = React.useState(getVcTemplates());

  const handleLogoChange = async(e)=>{
    const f = e.target.files?.[0];
    if(f){ setLogoDataUrl(await fileToDataUrl(f)); }
  };

  const handleCreate = ()=>{
    if(!name){ alert('認定名を入力してください'); return; }
    const tpl = { id:`vctpl-${Date.now()}`, issuer:ADMIN_ISSUER_DID, name, logo:logoDataUrl, createdAt:new Date().toISOString(), type:['VerifiableCredential','OrganizationAward']};
    saveVcTemplate(tpl);
    setTemplates(getVcTemplates());
    setName(''); setLogoDataUrl('');
    alert('VCテンプレートを作成しました');
  };

  const handleDelete=(id)=>{ deleteVcTemplate(id); setTemplates(getVcTemplates()); };

  return (
    <div>
      <h2>VC発行（テンプレート作成）</h2>
      <div style={{marginBottom:8}}>
        <label>認定名：</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="例）読書認定10級" style={{width:260}}/>
      </div>
      <div style={{marginBottom:8}}>
        <label>ロゴ（任意）：</label>
        <input type="file" accept="image/*" onChange={handleLogoChange}/>
        {logoDataUrl && <div style={{marginTop:6}}><img src={logoDataUrl} alt="logo" style={{maxWidth:120,maxHeight:120}}/></div>}
      </div>
      <button onClick={handleCreate}>テンプレートを保存</button>
      <h3 style={{marginTop:20}}>テンプレート一覧</h3>
      {templates.length===0 && <p>テンプレートはありません。</p>}
      <ul>
        {templates.map(t=><li key={t.id} style={{marginBottom:8}}><strong>{t.name}</strong>（issuer: {t.issuer}） <button onClick={()=>handleDelete(t.id)}>削除</button></li>)}
      </ul>
    </div>
  );
};

// ================== VC付与 ==================
const VcAssignScreen = () => {
  const [didList,setDidList] = React.useState(getAllDidsFromHistory());
  const [templates,setTemplates] = React.useState(getVcTemplates());
  const [selectedDid,setSelectedDid] = React.useState('');
  const [selectedTplId,setSelectedTplId] = React.useState('');
  const [manualDid,setManualDid] = React.useState('');

  const handleAssign = ()=>{
    if(!selectedDid || !selectedTplId){ alert('DID と テンプレートを選択してください'); return; }
    const tpl = templates.find(t=>t.id===selectedTplId);
    if(!tpl){ alert('テンプレートが見つかりません'); return; }
    const vc = { id:`vc-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type:tpl.type||['VerifiableCredential','OrganizationAward'], issuer:tpl.issuer||ADMIN_ISSUER_DID, holder:selectedDid, issuanceDate:new Date().toISOString(), credentialSubject:{id:selectedDid,title:tpl.name,logo:tpl.logo||null,awardedBy:'CAICA'} };
    appendVcForDid(selectedDid,vc);
    alert('VCを付与しました');
  };

  const addManualDid = ()=>{
    if(!manualDid) return;
    if(!didList.some(x=>x.did===manualDid)) setDidList([{email:'(手入力)',did:manualDid},...didList]);
    setSelectedDid(manualDid); setManualDid('');
  };

  return (
    <div>
      <h2>VC付与</h2>
      <div style={{marginBottom:10}}>
        <label>対象DID：</label>
        <select value={selectedDid} onChange={e=>setSelectedDid(e.target.value)} style={{width:420}}>
          <option value="">選択してください</option>
          {didList.map(x=><option key={x.did} value={x.did}>{x.email?`${x.email} — `:''}{x.did}</option>)}
        </select>
      </div>
      <div style={{marginBottom:6}}>
        <small>※ 履歴に無い場合は手入力：</small>
        <input value={manualDid} onChange={e=>setManualDid(e.target.value)} placeholder="did:key:..." style={{width:320}}/>
        <button onClick={addManualDid} style={{marginLeft:8}}>追加</button>
      </div>
      <div style={{margin:'16px 0'}}>
        <label>テンプレート：</label>
        <select value={selectedTplId} onChange={e=>setSelectedTplId(e.target.value)} style={{width:420}}>
          <option value="">選択してください</option>
          {templates.map(t=><option key={t.id} value={t.id}>{t.name}（issuer: {t.issuer}）</option>)}
        </select>
        {templates.length===0 && <p style={{color:'red'}}>テンプレートがありません。先に「VC発行（テンプレート作成）」で作成してください。</p>}
      </div>
      <button onClick={handleAssign} disabled={!selectedDid||!selectedTplId}>VC付与</button>
    </div>
  );
};

// ================== 管理者専用ルートガード ==================
const AdminRoute = ({ element })=> isAdmin()? element : <Navigate to="/admin-login" replace />;

// ================== ルーティング ==================
export default function App(){
  const [admin,setAdmin] = React.useState(isAdmin());
  const handleLogout = ()=>{
    setAdminLoggedIn(false); setAdmin(false); alert('管理者をログアウトしました');
  };
  React.useEffect(()=>{
    const handler = ()=>setAdmin(isAdmin());
    window.addEventListener('storage',handler);
    return ()=>window.removeEventListener('storage',handler);
  },[]);

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>DIDアプリ</h1>
          {admin && <button onClick={handleLogout} style={{marginLeft:12}}>管理者ログアウト</button>}
        </header>

        <main>
          <Routes>
            <Route path="/" element={<IdIssueScreen />} />
            <Route path="/display-id" element={<IdDisplayScreen />} />
            <Route path="/display-vc" element={<VcDisplayScreen />} />
            <Route path="/admin-login" element={<AdminLoginScreen onLogin={setAdmin}/>} />
            <Route path="/issue-vc" element={<AdminRoute element={<VcIssueScreen />} />} />
            <Route path="/assign-vc" element={<AdminRoute element={<VcAssignScreen />} />} />
          </Routes>
        </main>

        <nav className="bottom-nav">
          <Link to="/">ID発行</Link>
          <Link to="/display-id">ID表示</Link>
          <Link to="/display-vc">VC表示</Link>
          {admin && <Link to="/issue-vc">VC発行</Link>}
          {admin && <Link to="/assign-vc">VC付与</Link>}
          {!admin && <Link to="/admin-login">管理者ログイン</Link>}
        </nav>
      </div>
    </Router>
  );
}
