// src/services/didKey.js
import nacl from 'tweetnacl';
import { base58btc } from 'multiformats/bases/base58';
import varint from 'varint';   // ← 単体パッケージを利用

const MULTICODEC_ED25519 = 0xED; // 237
const STORAGE_KEY_DIDS = "myapp_dids";
const STORAGE_KEY_VCS = "myapp_vcs";

/**
 * DID:key を新規発行し、localStorage に保存する
 */
export function issueDidKey() {
  const { publicKey, secretKey } = nacl.sign.keyPair();

  // ✅ varint.encode を利用
  const prefix = Uint8Array.from(varint.encode(MULTICODEC_ED25519));
  const multicodecPub = new Uint8Array([...prefix, ...publicKey]);

  const did = `did:key:${base58btc.encode(multicodecPub)}`;

  const entry = {
    did,
    secretKeyBase58: base58btc.encode(secretKey),
    didDocument: buildDoc(did, multicodecPub),
  };

  // ---- 永続保存処理 ----
  const list = getStoredDids();
  list.push(entry);
  localStorage.setItem(STORAGE_KEY_DIDS, JSON.stringify(list));

  return entry;
}

/**
 * 保存されている DID の一覧を取得
 */
export function getStoredDids() {
  const raw = localStorage.getItem(STORAGE_KEY_DIDS);
  return raw ? JSON.parse(raw) : [];
}

/**
 * VC を保存（ダミー含む）
 */
export function saveVc(vcObject) {
  const list = getStoredVcs();
  list.push(vcObject);
  localStorage.setItem(STORAGE_KEY_VCS, JSON.stringify(list));
}

/**
 * 保存済み VC 一覧を取得
 */
export function getStoredVcs() {
  const raw = localStorage.getItem(STORAGE_KEY_VCS);
  return raw ? JSON.parse(raw) : [];
}

/**
 * DID の解決
 */
export function resolveDidKey(did) {
  if (!did.startsWith('did:key:z')) throw new Error('invalid did:key');
  const multibase = did.slice(8);
  const bytes = base58btc.decode(multibase);

  const code = varint.decode(bytes);
  if (code !== MULTICODEC_ED25519) {
    throw new Error(`Unsupported multicodec: 0x${code.toString(16)}`);
  }

  return buildDoc(did, bytes);
}

/**
 * DID Document を構築
 */
function buildDoc(did, multicodecPub) {
  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    id: did,
    verificationMethod: [{
      id: `${did}#${did.substring(8)}`,
      type: "Ed25519VerificationKey2020",
      controller: did,
      publicKeyMultibase: `z${base58btc.encode(multicodecPub)}`
    }],
    authentication: [`${did}#${did.substring(8)}`],
    assertionMethod: [`${did}#${did.substring(8)}`],
  };
}
