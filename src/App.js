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
// 実運用では環境変数やサーバ連携に置き換えてください
const ADMIN_PASSWORD = 'admin1234';
const ADMIN_ISSUER_DID = 'did:example:caica-admin';

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
// 全メールの履歴から DID 一覧を集約（VC付与画面用）
function getAllDidsFromHistory() {
  const historyByEmail = JSON.parse(localStorage.getItem('didHistoryByEmail') || '{}');
  const list = [];
  Object.entries(historyByEmail).forEach(([email, arr]) => {
    (arr || []).forEach((issued) => {
      list.push({ email, did: issued.did, method: issued.method });
    });
  });
  // 重複 DID を除外
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

// ================== ダミーVC生成（社員自己発行のサンプル） ==================
const vcTemplatesDummy = [
  {
    type: ['VerifiableCredential', 'EmailCredential'],
    subject: (did, email) => ({ id: did, email }),
    issuanceDate: '2023-01-01T00:00:00Z'
  },
  {
    type: ['VerifiableCredential', 'ProfileCredential'],
    subject: (did) => ({ id: did, name: `User ${did}` }),
    issuanceDate: '2023-02-01T00:00:00Z'
  },
  {
    type: ['VerifiableCredential', 'MembershipCredential'],
    subject: (did) => ({ id: did, membership: 'Premium Plan' }),
    issuanceDate: '2023-03-01T00:00:00Z'
  }
];
function generateDummyVcs(did, email) {
  const lastChar = did.slice(-1);
  const numVcs = parseInt(lastChar, 36) % vcTemplatesDummy.length + 1;
  return vcTemplatesDummy.slice(0, numVcs).map((tpl, idx) => ({
    id: `http://example.edu/credentials/${did}-${idx + 1}`,
    type: tpl.type,
    credentialSubject: tpl.subject(did, email),
    issuer: did,
    issuanceDate: tpl.issuanceDate
  }));
}

// ================== ユーティリティ ==================
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data URL
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ================== DID表示折り返し ==================
function BreakableDid({ did, chunkSize = 25 }) {
  if (!did) return null;
  return (
    <>
      {did.match(new RegExp(`.{1,${chunkSize}}`, 'g')).map((chunk, i) => (
        <React.Fragment key={i}>
          {chunk}
          <br />
        </React.Fragment>
      ))}
    </>
  );
}

// ================== 画面コンポーネント ==================
const IdIssueScreen = () => {
  const [method, setMethod] = React.useState('key');
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
      const data = method === 'key' ? issueDidKey() : issueDidEthr();
      const issued = { ...data, email };

      // VC保存（自己発行側のダミー）
      const dummyVcs = generateDummyVcs(issued.did, email);
      saveVcsForDid(issued.did, dummyVcs);

      // DID履歴保存
      saveDidHistory(email, issued);

      // lastContext更新
      setLastContext({ email, did: issued.did });

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
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
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
  const issued = location.state?.issued;
  const [did, setDid] = React.useState(issued?.did || '');
  const [doc, setDoc] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [history, setHistory] = React.useState([]);

  React.useEffect(() => {
    if (issued?.email) {
      setHistory(getDidHistoryByEmail(issued.email));
      // lastContext更新
      setLastContext({ email: issued.email, did: issued.did });
    }
  }, [issued]);

  const handleResolve = async () => {
    try {
      setErr(null);
      const d = await universalResolve(did.trim());
      setDoc(d);
      // 入力したdidをlastContextに反映
      const ctx = getLastContext();
      setLastContext({ email: ctx.email, did });
    } catch (e) {
      setDoc(null);
      setErr(e.message);
    }
  };

  // 入力中も lastContext.did を更新（VC表示で単一DIDを表示するため）
  React.useEffect(() => {
    if (did) {
      const ctx = getLastContext();
      setLastContext({ email: ctx.email, did });
    }
  }, [did]);

  return (
    <div>
      <h2>DID表示</h2>
      {issued && <p>メールアドレス: {issued.email}</p>}
      <input
        value={did}
        onChange={(e) => setDid(e.target.value)}
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
          <li key={idx}>
            <BreakableDid did={item.did} />
          </li>
        ))}
      </ul>
    </div>
  );
};

const VcDisplayScreen = () => {
  const location = useLocation();
  let { inputDid } = location.state || {};

  // stateがなければlastContextを利用（単一 DID のみ）
  const ctx = getLastContext();
  const currentDid = inputDid || ctx.did;

  const [allVcs, setAllVcs] = React.useState([]);

  React.useEffect(() => {
    if (!currentDid) return;
    const vcsForDid = getVcsByDid(currentDid);
    setAllVcs(vcsForDid.map((vc) => ({ did: currentDid, vc })));
  }, [currentDid]);

  if (!currentDid) {
    return <p>対象のDIDが指定されていません。</p>;
  }

  return (
    <div>
      <h2>VC一覧</h2>
      {allVcs.length === 0 && <p>VCは存在しません。</p>}
      {allVcs.map((item, idx) => (
        <div key={idx} style={{ border: '1px solid #ccc', padding: '8px', marginBottom: '12px' }}>
          <p>
            <strong>
              DID: <BreakableDid did={item.did} />
            </strong>
          </p>
          <pre>{JSON.stringify(item.vc, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
};

// ================== 管理者ログイン ==================
const AdminLoginScreen = () => {
  const [pw, setPw] = React.useState('');
  const navigate = useNavigate();

  const handleLogin = () => {
    if (pw === ADMIN_PASSWORD) {
      setAdminLoggedIn(true);
      alert('管理者としてログインしました');
      navigate('/issue-vc');
    } else {
      alert('パスワードが違います');
    }
  };

  return (
    <div>
      <h2>管理者ログイン</h2>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="管理者パスワード"
        style={{ width: 240 }}
      />
      <div>
        <button onClick={handleLogin} disabled={!pw}>
          ログイン
        </button>
      </div>
    </div>
  );
};

// ================== VC発行（テンプレート作成・管理者専用） ==================
const VcIssueScreen = () => {
  const [name, setName] = React.useState('');
  const [logoDataUrl, setLogoDataUrl] = React.useState('');
  const [templates, setTemplates] = React.useState(getVcTemplates());

  const handleLogoChange = async (e) => {
    const f = e.target.files?.[0];
    if (f) {
      const dataUrl = await fileToDataUrl(f);
      setLogoDataUrl(dataUrl);
    }
  };

  const handleCreate = () => {
    if (!name) {
      alert('認定名を入力してください');
      return;
    }
    const tpl = {
      id: `vctpl-${Date.now()}`,
      issuer: ADMIN_ISSUER_DID,
      name,
      logo: logoDataUrl, // 任意
      createdAt: new Date().toISOString(),
      type: ['VerifiableCredential', 'OrganizationAward'] // 例
    };
    saveVcTemplate(tpl);
    setTemplates(getVcTemplates());
    setName('');
    setLogoDataUrl('');
    alert('VCテンプレートを作成しました');
  };

  const handleDelete = (id) => {
    deleteVcTemplate(id);
    setTemplates(getVcTemplates());
  };

  return (
    <div>
      <h2>VC発行（テンプレート作成）</h2>
      <div style={{ marginBottom: 8 }}>
        <label>認定名：</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例）読書認定10級" style={{ width: 260 }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>ロゴ（任意）：</label>
        <input type="file" accept="image/*" onChange={handleLogoChange} />
        {logoDataUrl && (
          <div style={{ marginTop: 6 }}>
            <img src={logoDataUrl} alt="logo" style={{ maxWidth: 120, maxHeight: 120 }} />
          </div>
        )}
      </div>
      <button onClick={handleCreate}>テンプレートを保存</button>

      <h3 style={{ marginTop: 20 }}>テンプレート一覧</h3>
      {templates.length === 0 && <p>テンプレートはありません。</p>}
      <ul>
        {templates.map((t) => (
          <li key={t.id} style={{ marginBottom: 8 }}>
            <strong>{t.name}</strong>（issuer: {t.issuer}）{' '}
            <button onClick={() => handleDelete(t.id)}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ================== VC付与（管理者専用） ==================
const VcAssignScreen = () => {
  const [didList, setDidList] = React.useState(getAllDidsFromHistory());
  const [templates, setTemplates] = React.useState(getVcTemplates());

  const [selectedDid, setSelectedDid] = React.useState('');
  const [selectedTplId, setSelectedTplId] = React.useState('');

  const handleAssign = () => {
    if (!selectedDid || !selectedTplId) {
      alert('DID と テンプレートを選択してください');
      return;
    }
    const tpl = templates.find((t) => t.id === selectedTplId);
    if (!tpl) {
      alert('テンプレートが見つかりません');
      return;
    }

    // 付与する VC（発行者＝管理者、保持者＝選択DID）
    const vc = {
      id: `vc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: tpl.type || ['VerifiableCredential', 'OrganizationAward'],
      issuer: tpl.issuer || ADMIN_ISSUER_DID,
      holder: selectedDid,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: selectedDid,
        title: tpl.name,
        logo: tpl.logo || null,
        awardedBy: 'CAICA',
      }
    };

    appendVcForDid(selectedDid, vc);
    alert('VCを付与しました');
  };

  // DID がゼロの場合の補助：手入力欄
  const [manualDid, setManualDid] = React.useState('');
  const addManualDid = () => {
    if (!manualDid) return;
    if (!didList.some((x) => x.did === manualDid)) {
      setDidList([{ email: '(手入力)', did: manualDid }, ...didList]);
    }
    setSelectedDid(manualDid);
    setManualDid('');
  };

  return (
    <div>
      <h2>VC付与</h2>

      <div style={{ marginBottom: 10 }}>
        <label>対象DID：</label>
        <select value={selectedDid} onChange={(e) => setSelectedDid(e.target.value)} style={{ width: 420 }}>
          <option value="">選択してください</option>
          {didList.map((x) => (
            <option key={x.did} value={x.did}>
              {x.email ? `${x.email} — ` : ''}{x.did}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 6 }}>
        <small>※ 履歴に無い場合は手入力：</small>
        <input value={manualDid} onChange={(e) => setManualDid(e.target.value)} placeholder="did:key:..." style={{ width: 320 }} />
        <button onClick={addManualDid} style={{ marginLeft: 8 }}>追加</button>
      </div>

      <div style={{ margin: '16px 0' }}>
        <label>テンプレート：</label>
        <select value={selectedTplId} onChange={(e) => setSelectedTplId(e.target.value)} style={{ width: 420 }}>
          <option value="">選択してください</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}（issuer: {t.issuer}）
            </option>
          ))}
        </select>
        {templates.length === 0 && (
          <p style={{ color: 'red' }}>テンプレートがありません。先に「VC発行（テンプレート作成）」で作成してください。</p>
        )}
      </div>

      <button onClick={handleAssign} disabled={!selectedDid || !selectedTplId}>
        VC付与
      </button>
    </div>
  );
};

// ================== 管理者専用ルートガード ==================
const AdminRoute = ({ element }) => {
  return isAdmin() ? element : <Navigate to="/admin-login" replace />;
};

// ================== ルーティング ==================
export default function App() {
  const [admin, setAdmin] = React.useState(isAdmin());

  const handleLogout = () => {
    setAdminLoggedIn(false);
    setAdmin(false);
    alert('管理者をログアウトしました');
  };

  React.useEffect(() => {
    const handler = () => setAdmin(isAdmin());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>DIDアプリ</h1>
          {admin && (
            <button onClick={handleLogout} style={{ marginLeft: 12 }}>
              管理者ログアウト
            </button>
          )}
        </header>

        <main>
          <Routes>
            <Route path="/" element={<IdIssueScreen />} />
            <Route path="/display-id" element={<IdDisplayScreen />} />
            <Route path="/display-vc" element={<VcDisplayScreen />} />

            {/* 管理者系 */}
            <Route path="/admin-login" element={<AdminLoginScreen />} />
            <Route path="/issue-vc" element={<AdminRoute element={<VcIssueScreen />} />} />
            <Route path="/assign-vc" element={<AdminRoute element={<VcAssignScreen />} />} />
          </Routes>
        </main>

        {/* ボトムナビ */}
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
