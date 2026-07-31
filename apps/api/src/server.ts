import { createApp } from "./app";

const { app, env } = createApp();

app.listen(env.port, () => {
  console.log(`AGENTIA API listening on http://localhost:${env.port}`);
});
