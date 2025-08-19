// src/services/didKey.js
import nacl from 'tweetnacl';
import { base58btc } from 'multiformats/bases/base58';
import varint from 'varint';   // ← 単体パッケージを利用

const MULTICODEC_ED25519 = 0xED; // 237

export function issueDidKey() {
  const { publicKey, secretKey } = nacl.sign.keyPair();

  // ✅ varint.encode を利用
  const prefix = Uint8Array.from(varint.encode(MULTICODEC_ED25519));
  console.log("🔑 [DEBUG] prefix (should be [237,1]):", prefix);

  const multicodecPub = new Uint8Array([...prefix, ...publicKey]);
  console.log("🔑 [DEBUG] multicodecPub (prefix+publicKey):", multicodecPub);

  const did = `did:key:${base58btc.encode(multicodecPub)}`;
  console.log("✅ [DEBUG] issued DID:", did);

  return {
    did,
    secretKeyBase58: base58btc.encode(secretKey),
    didDocument: buildDoc(did, multicodecPub),
  };
}

export function resolveDidKey(did) {
  if (!did.startsWith('did:key:z')) throw new Error('invalid did:key');
  const multibase = did.slice(8);
  const bytes = base58btc.decode(multibase);

  console.log("📥 [DEBUG] decodedBytes from DID:", bytes);

  // ✅ varint.decode は値だけ返す
  const code = varint.decode(bytes);
  console.log("📥 [DEBUG] decoded multicodec code:", code, "(expected 237)");

  if (code !== MULTICODEC_ED25519) {
    throw new Error(`Unsupported multicodec: 0x${code.toString(16)}`);
  }

  return buildDoc(did, bytes);
}

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
