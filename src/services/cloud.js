// src/services/cloud.js
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { app } from "../firebaseConfig";

const db = getFirestore(app);

/*
  データ構造方針（ローカルストレージ版に合わせる）
  - users/<email>:
      {
        did: "最新 did string",
        didHistory: ["did:key:xxx", "did:key:yyy"],   // ← 文字列配列（重要）
        // optional: didDocuments: { "<did>": { ...didDocument... } }
      }
  - vcs/<did>:
      {
        vc: [ { ...vc1... }, { ...vc2... } ]  // DID に紐づく VC 配列
      }
*/

// ---------- DID 関連 ----------

// 最新 DID を保存（上書きで問題なし）
export async function saveDid(userEmail, did) {
  try {
    if (!userEmail) throw new Error("userEmail required");
    await setDoc(doc(db, "users", userEmail), { did }, { merge: true });
    console.log("✅ saveDid:", userEmail, did);
  } catch (e) {
    console.error("❌ saveDid error:", e);
    throw e;
  }
}

// DID 履歴を文字列配列として保存（重複を避けつつ append）
export async function saveDidHistory(userEmail, did) {
  try {
    if (!userEmail) throw new Error("userEmail required");
    if (!did) throw new Error("did required");

    const userRef = doc(db, "users", userEmail);
    const snap = await getDoc(userRef);
    let history = [];
    if (snap.exists() && Array.isArray(snap.data().didHistory)) {
      history = snap.data().didHistory;
    }

    // 重複チェック（同一 DID を何度も push しない）
    if (!history.includes(did)) {
      history.push(did);
      // merge: true を使って既存フィールドは壊さない
      await setDoc(userRef, { didHistory: history }, { merge: true });
      console.log("✅ saveDidHistory appended:", userEmail, did);
    } else {
      console.log("ℹ️ did already in history:", did);
    }
  } catch (e) {
    console.error("❌ saveDidHistory error:", e);
    throw e;
  }
}

// （管理者など向け）全ユーザーを取得
export async function getAllUsers() {
  try {
    const q = await getDocs(collection(db, "users"));
    return q.docs.map(d => ({ email: d.id, ...d.data() }));
  } catch (e) {
    console.error("❌ getAllUsers error:", e);
    return [];
  }
}

// 特定ユーザーの didHistory を取得（文字列配列を返す）
export async function getAllDidsFromHistory(userEmail) {
  try {
    if (!userEmail) return [];
    const snap = await getDoc(doc(db, "users", userEmail));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.didHistory)) return data.didHistory;
      // 互換性: もし過去にオブジェクト配列で保存されてしまっている場合は変換を試みる
      if (Array.isArray(data.didHistoryObjects)) {
        return data.didHistoryObjects.map(x => (typeof x === "string" ? x : (x.did || ""))).filter(Boolean);
      }
    }
    return [];
  } catch (e) {
    console.error("❌ getAllDidsFromHistory error:", e);
    return [];
  }
}

// ---------- VC 関連 ----------

// DID に紐づく VC 配列を取得（配列を返す）
export async function getVcsByDid(did) {
  try {
    if (!did) return [];
    const ref = doc(db, "vcs", did);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.vc)) return data.vc;
      // 互換性：もし vc が単一オブジェクトで保存されていたら配列にする
      if (data.vc && typeof data.vc === "object") return [data.vc];
    }
    return [];
  } catch (e) {
    console.error("❌ getVcsByDid error:", e);
    return [];
  }
}

// VC を上書き保存（vc 配列全体をセット）
export async function saveVC(did, vcArray) {
  try {
    if (!did) throw new Error("did required");
    if (!Array.isArray(vcArray)) throw new Error("vcArray must be array");
    await setDoc(doc(db, "vcs", did), { vc: vcArray }, { merge: true });
    console.log("✅ saveVC for did:", did);
  } catch (e) {
    console.error("❌ saveVC error:", e);
    throw e;
  }
}

// VC を追加（既存配列に push）。存在しなければ新規ドキュメントを作成。
export async function appendVcForDid(did, newVc) {
  try {
    if (!did) throw new Error("did required");
    if (!newVc) throw new Error("newVc required");

    const ref = doc(db, "vcs", did);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // 新規作成（vc を配列で保存）
      await setDoc(ref, { vc: [newVc] }, { merge: true });
      console.log("✅ appendVcForDid: created new vcs doc for", did);
      return;
    }

    const existing = snap.data().vc;
    if (Array.isArray(existing)) {
      existing.push(newVc);
      await updateDoc(ref, { vc: existing });
    } else {
      // 既存が未配列の場合は配列に変換して保存
      const arr = existing ? [existing, newVc] : [newVc];
      await setDoc(ref, { vc: arr }, { merge: true });
    }
    console.log("✅ appendVcForDid: appended VC for", did);
  } catch (e) {
    console.error("❌ appendVcForDid error:", e);
    throw e;
  }
}
