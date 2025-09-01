// src/services/cloud.js
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs
} from "firebase/firestore";
import { app } from "../firebaseConfig";

const db = getFirestore(app);

/*
  データ構造方針
  - users/<email>:
      {
        did: "最新 did string",
        didHistory: ["did:key:xxx", "did:key:yyy"]   // ← 文字列配列
      }
  - vcs/<did>:
      {
        vc: [ { ...vc1... }, { ...vc2... } ]        // DID に紐づく VC 配列
      }
*/

// ---------- DID 関連 ----------

// 最新 DID を保存
export async function saveDid(userEmail, did) {
  try {
    if (!userEmail) throw new Error("userEmail required");
    if (!did) throw new Error("did required");

    const cleanDid = did.trim();

    await setDoc(doc(db, "users", userEmail), { did: cleanDid }, { merge: true });
    console.log("✅ saveDid:", userEmail, cleanDid);
  } catch (e) {
    console.error("❌ saveDid error:", e);
    throw e;
  }
}

// DID 履歴を保存（重複を避けつつ文字列配列に追加）
export async function saveDidHistory(userEmail, did) {
  try {
    if (!userEmail) throw new Error("userEmail required");
    if (!did) throw new Error("did required");

    const cleanDid = did.trim();
    const userRef = doc(db, "users", userEmail);
    const snap = await getDoc(userRef);

    let history = [];
    if (snap.exists() && Array.isArray(snap.data().didHistory)) {
      history = snap.data().didHistory.map(d => d.trim());
    }

    if (!history.includes(cleanDid)) {
      history.push(cleanDid);
      await setDoc(userRef, { didHistory: history }, { merge: true });
      console.log("✅ saveDidHistory appended:", userEmail, cleanDid);
    } else {
      console.log("ℹ️ did already in history:", cleanDid);
    }
  } catch (e) {
    console.error("❌ saveDidHistory error:", e);
    throw e;
  }
}

// 全ユーザー取得（管理用）
export async function getAllUsers() {
  try {
    const q = await getDocs(collection(db, "users"));
    return q.docs.map(d => ({ email: d.id, ...d.data() }));
  } catch (e) {
    console.error("❌ getAllUsers error:", e);
    return [];
  }
}

// 特定ユーザーの DID 履歴取得
export async function getAllDidsFromHistory(userEmail) {
  try {
    if (!userEmail) return [];
    const snap = await getDoc(doc(db, "users", userEmail));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.didHistory)) return data.didHistory.map(d => d.trim());

      // 互換性対応：過去に別形式で保存されていた場合
      if (Array.isArray(data.didHistoryObjects)) {
        return data.didHistoryObjects
          .map(x => (typeof x === "string" ? x : (x.did || "")))
          .filter(Boolean)
          .map(d => d.trim());
      }
    }
    return [];
  } catch (e) {
    console.error("❌ getAllDidsFromHistory error:", e);
    return [];
  }
}

// ---------- VC 関連 ----------

// DID に紐づく VC 配列を取得
export async function getVcsByDid(did) {
  try {
    if (!did) return [];
    const cleanDid = did.trim();
    const ref = doc(db, "vcs", cleanDid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.vc)) return data.vc;
      if (data.vc && typeof data.vc === "object") return [data.vc];
    }
    return [];
  } catch (e) {
    console.error("❌ getVcsByDid error:", e);
    return [];
  }
}

// VC を保存（配列ごと上書き）
export async function saveVC(did, vcArray) {
  try {
    if (!did) throw new Error("did required");
    if (!Array.isArray(vcArray)) throw new Error("vcArray must be array");

    const cleanDid = did.trim();
    await setDoc(doc(db, "vcs", cleanDid), { vc: vcArray }, { merge: true });
    console.log("✅ saveVC for did:", cleanDid);
  } catch (e) {
    console.error("❌ saveVC error:", e);
    throw e;
  }
}

// VC を追加保存（既存配列に push）
export async function appendVcForDid(did, newVc) {
  try {
    if (!did) throw new Error("did required");
    if (!newVc) throw new Error("newVc required");

    const cleanDid = did.trim();
    const ref = doc(db, "vcs", cleanDid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, { vc: [newVc] }, { merge: true });
      console.log("✅ appendVcForDid: created new vcs doc for", cleanDid);
      return;
    }

    let vcs = [];
    if (Array.isArray(snap.data().vc)) {
      vcs = snap.data().vc;
    } else if (snap.data().vc) {
      vcs = [snap.data().vc];
    }

    vcs.push(newVc);
    await setDoc(ref, { vc: vcs }, { merge: true });
    console.log("✅ appendVcForDid: appended VC for", cleanDid);
  } catch (e) {
    console.error("❌ appendVcForDid error:", e);
    throw e;
  }
}
