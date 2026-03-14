const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const API_KEY = process.env.ROBLOX_API_KEY;
const SECRET = process.env.SECRET;

app.get("/", (req, res) => {
  res.send("Rank API running");
});

async function getRoleIdFromRankNumber(groupId, rankNumber) {
  const response = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`, {
    method: "GET",
    headers: {
      "x-api-key": API_KEY
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Failed to fetch roles: ${response.status} ${text}`);
  }

  const data = JSON.parse(text);

  if (!data.roles || !Array.isArray(data.roles)) {
    throw new Error("Roles response is invalid.");
  }

  const role = data.roles.find(r => Number(r.rank) === Number(rankNumber));

  if (!role) {
    throw new Error(`No role found for rank number ${rankNumber}`);
  }

  return role.id;
}

app.post("/promote", async (req, res) => {
  const { groupId, userId, targetRank, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(403).json({ success: false, error: "Invalid secret" });
  }

  if (!groupId || !userId || !targetRank) {
    return res.status(400).json({
      success: false,
      error: "groupId, userId, and targetRank are required"
    });
  }

  try {
    const roleId = await getRoleIdFromRankNumber(groupId, targetRank);

    const response = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${groupId}/members/${userId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY
        },
        body: JSON.stringify({
          role: `groups/${groupId}/roles/${roleId}`
        })
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Roblox API request failed",
        status: response.status,
        robloxResponse: text
      });
    }

    return res.json({
      success: true,
      message: "Promotion successful",
      roleId,
      robloxResponse: text
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log("Rank API running");
});
