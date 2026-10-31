import express from "express";
const app = express();
app.get('/', (req, res) => {
    [
        res.json("landing page")
    ];
});
export { app };
