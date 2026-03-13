const express = require("express")
const fetch = require("node-fetch")

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000

const API_KEY = process.env.ROBLOX_API_KEY
const SECRET = process.env.SECRET

app.post("/promote", async (req,res)=>{

    const {groupId,userId,targetRank,secret} = req.body

    if(secret !== SECRET){
        return res.status(403).json({error:"Invalid secret"})
    }

    try{

        const response = await fetch(
            `https://apis.roblox.com/groups/v1/groups/${groupId}/users/${userId}`,
            {
                method:"PATCH",
                headers:{
                    "Content-Type":"application/json",
                    "x-api-key":API_KEY
                },
                body: JSON.stringify({
                    roleId: targetRank
                })
            }
        )

        const data = await response.text()

        res.json({
            success:true,
            robloxResponse:data
        })

    }catch(err){

        res.status(500).json({
            error:err.message
        })

    }

})

app.listen(PORT,()=>{
    console.log("Rank API running")
})
