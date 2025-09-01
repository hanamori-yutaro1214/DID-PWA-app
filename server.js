const express = require("express");
const fs = require("fs");
const cors = require("cors");
const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

const DATA_FILE = "vcData.json";

// VC保存
app.post("/save-vc", (req, res) => {
  const { did, vc } = req.body;
  if (!did || !vc) {
    return res.status(400).json({ error: "DID and VC are required" });
  }

  let data = {};
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
  }

  // DIDごとにVCを配列で保存
  if (!data[did]) data[did] = [];
  data[did].push(vc);

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// VC取得
app.get("/get-vc/:did", (req, res) => {
  const did = req.params.did;
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({ vcs: [] });
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  res.json({ vcs: data[did] || [] });
});

app.listen(PORT, () => {
  console.log(`✅ VCサーバー起動: http://localhost:${PORT}`);
});
