const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend running");
});

app.post("/leetcode", async (req, res) => {
  try {
    const response = await axios.post(
      "https://leetcode.com/graphql",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          Referer: "https://leetcode.com",
          Origin: "https://leetcode.com",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.log(err.message);

    res.status(500).json({
      error: "Failed to fetch data",
    });
  }
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});