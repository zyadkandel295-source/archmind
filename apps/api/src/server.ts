import { createApp } from "./app";

const { app, env } = createApp();

app.listen(env.port, () => {
  console.log(`ArchMind API listening on http://localhost:${env.port}`);
});
