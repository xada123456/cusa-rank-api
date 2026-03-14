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
  if (!API_KEY) throw new Error("Missing ROBLOX_API_KEY");
  if (!SECRET) throw new Error("Missing SECRET");
}

async function getRoleIdFromRankNumber(groupId, rankNumber) {

  const response = await fetch(
    `https://groups.roblox.com/v1/groups/${groupId}/roles`
  );

  const text = await response.text();
  console.log("[ROLES RAW]", text);

  if (!response.ok) {
    throw new Error(`Failed to fetch roles: ${response.status}`);
  }

  const data = JSON.parse(text);

  const role = data.roles.find(r => r.rank === Number(rankNumber));

  if (!role) {
    throw new Error("Role not found for rank: " + rankNumber);
  }

  return role.id;
}

async function getMembershipId(groupId, userId) {

  const response = await fetch(
    `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships`,
    {
      headers: {
        "x-api-key": API_KEY
      }
    }
  );

  const text = await response.text();
  console.log("[MEMBERSHIPS RAW]", text);

  if (!response.ok) {
    throw new Error(`Membership fetch failed: ${response.status}`);
  }

  const data = JSON.parse(text);

  const memberships = data.groupMemberships || data.memberships || [];

  for (const m of memberships) {

    const userMatch = String(m.user || "").match(/users\/(\d+)/);

    if (userMatch && Number(userMatch[1]) === Number(userId)) {

      const membershipMatch = String(m.path || "").match(/memberships\/(.+)/);

      if (membershipMatch) {
        return membershipMatch[1];
      }

      if (m.id) {
        return m.id;
      }
    }
  }

  throw new Error("Membership not found for user");
}

app.post("/promote", async (req, res) => {

  try {

    validateEnv();

    const { groupId, userId, targetRank, secret } = req.body;

    if (secret !== SECRET) {
      return res.status(403).json({
        success:false,
        error:"Invalid secret"
      });
    }

    const numericGroupId = Number(groupId);
    const numericUserId = Number(userId);
    const numericTargetRank = Number(targetRank);

    const roleId = await getRoleIdFromRankNumber(
      numericGroupId,
      numericTargetRank
    );

    const membershipId = await getMembershipId(
      numericGroupId,
      numericUserId
    );

    console.log("[ROLE FOUND]", {
      roleId,
      membershipId
    });

    const response = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${numericGroupId}/memberships/${membershipId}`,
      {
        method:"PATCH",
        headers:{
          "Content-Type":"application/json",
          "x-api-key":API_KEY
        },
        body: JSON.stringify({
          role: `groups/${numericGroupId}/roles/${roleId}`
        })
      }
    );

    const text = await response.text();

    console.log("[PATCH RESULT]", text);

    if (!response.ok) {
      return res.status(response.status).json({
        success:false,
        roblox:text
      });
    }

    return res.json({
      success:true,
      message:"Promotion success",
      roleId,
      membershipId
    });

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false,
      error:err.message
    });

  }

});

app.listen(PORT, () => {
  console.log("Rank API running on port", PORT);
});
