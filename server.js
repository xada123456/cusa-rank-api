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

app.get("/test", (req, res) => {
  res.json({
    ok: true,
    hasApiKey: !!API_KEY,
    hasSecret: !!SECRET
  });
});

function validateEnv() {
  if (!API_KEY) {
    throw new Error("Missing ROBLOX_API_KEY environment variable");
  }
  if (!SECRET) {
    throw new Error("Missing SECRET environment variable");
  }
}

async function getRoleIdFromRankNumber(groupId, rankNumber) {
  const response = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`, {
    method: "GET",
    headers: {
      "x-api-key": API_KEY
    }
  });

  const text = await response.text();
  console.log("[ROLES RAW]", text);

  if (!response.ok) {
    throw new Error(`Failed to fetch roles: ${response.status} ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from roles endpoint: ${text}`);
  }

  if (!data.roles || !Array.isArray(data.roles)) {
    throw new Error("Roles response is invalid.");
  }

  console.log("[ROLES LIST]", data.roles.map(r => ({
    id: r.id,
    name: r.name,
    rank: r.rank
  })));

  const role = data.roles.find(r => Number(r.rank) === Number(rankNumber));

  if (!role) {
    throw new Error(`No role found for rank number ${rankNumber}`);
  }

  return role.id;
}

app.post("/promote", async (req, res) => {
  try {
    validateEnv();

    const { groupId, userId, targetRank, secret } = req.body;

    console.log("[PROMOTE INCOMING]", {
      groupId,
      userId,
      targetRank,
      hasSecret: !!secret
    });

    if (secret !== SECRET) {
      return res.status(403).json({
        success: false,
        error: "Invalid secret"
      });
    }

    if (groupId === undefined || userId === undefined || targetRank === undefined) {
      return res.status(400).json({
        success: false,
        error: "groupId, userId, and targetRank are required"
      });
    }

    const numericGroupId = Number(groupId);
    const numericUserId = Number(userId);
    const numericTargetRank = Number(targetRank);

    if (
      Number.isNaN(numericGroupId) ||
      Number.isNaN(numericUserId) ||
      Number.isNaN(numericTargetRank)
    ) {
      return res.status(400).json({
        success: false,
        error: "groupId, userId, and targetRank must be numbers"
      });
    }

    const roleId = await getRoleIdFromRankNumber(numericGroupId, numericTargetRank);

    console.log("[ROLE FOUND]", {
      groupId: numericGroupId,
      userId: numericUserId,
      targetRank: numericTargetRank,
      roleId
    });

    const response = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${numericGroupId}/memberships/users/${numericUserId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY
        },
        body: JSON.stringify({
          role: `groups/${numericGroupId}/roles/${roleId}`
        })
      }
    );

    const text = await response.text();

    console.log("[ROBLOX PATCH RESULT]", {
      status: response.status,
      ok: response.ok,
      body: text
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Roblox API request failed",
        status: response.status,
        robloxResponse: text
      });
    }

    let parsedResponse;
    try {
      parsedResponse = text ? JSON.parse(text) : null;
    } catch {
      parsedResponse = text;
    }

    return res.json({
      success: true,
      message: "Promotion successful",
      roleId,
      robloxResponse: parsedResponse
    });
  } catch (err) {
    console.error("[PROMOTE ERROR]", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Unknown server error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Rank API running on port ${PORT}`);
});
