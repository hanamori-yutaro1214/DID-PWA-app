// src/services/didEthr.js
import { ethers } from 'ethers';
import { Resolver } from 'did-resolver';
import { getResolver as ethrGetResolver } from 'ethr-did-resolver';

// ★ 必要に応じてRPCは環境変数に。例: Viteなら import.meta.env.VITE_RPC_URL
const RPC_URL = 'https://rpc.ankr.com/eth_sepolia'; // 任意のRPC
const CHAIN_NAME = 'sepolia'; // mainnet にするなら 'mainnet'

const ethrResolver = new Resolver({
  ...ethrGetResolver({
    networks: [{ name: CHAIN_NAME, rpcUrl: RPC_URL }]
  })
});

export function issueDidEthr() {
  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address;
  // did:ethr の表記：did:ethr:<network>:<address>
  const did = `did:ethr:${CHAIN_NAME}:${address}`;
  return {
    did,
    privateKey: wallet.privateKey, // 管理注意！
    address,
  };
}

export async function resolveDidEthr(did) {
  const doc = await ethrResolver.resolve(did);
  return doc.didDocument;
}
