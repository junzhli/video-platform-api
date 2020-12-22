import app from "./app";
import logger from "./libs/logger";

const log = logger("main");

app.listen(8080, () =>
    log.info("Video platform backend service listening on port 3000!")
);