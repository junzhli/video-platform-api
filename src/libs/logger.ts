import * as winston from "winston";
const { combine, timestamp, label, printf } = winston.format;
import * as packageJson from "../../package.json";
const LOGGER_NAME = packageJson.name;

const loggerFormat = printf(info => {
    if (info.error instanceof Error) {
        return `${info.timestamp} [${info.label}] ${info.level}: ${info.error.message} \n ${info.error.stack}`;
    }
    return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});

const infoLevel = new winston.transports.Console({
    level: "info",
    format: combine(
        label({
            label: LOGGER_NAME
        }),
        timestamp(),
        loggerFormat
    ),
    handleExceptions: true
});

const debugLevel = new winston.transports.Console({
    level: "debug",
    format: combine(
        label({
            label: LOGGER_NAME
        }),
        timestamp(),
        loggerFormat
    ),
    handleExceptions: true
});

// const errorFile = new winston.transports.File({
//     filename: "error.log",
//     level: "error",
//     handleExceptions: true
// });

const logger = (name: string = LOGGER_NAME) => {
    const _logger = winston.createLogger({
        level: "info",
        format: combine(
            label({
                label: name,
                message: true,
            }),
            timestamp(),
            loggerFormat
        ),
        transports: [infoLevel]
    });

    if (process.env.NODE_ENV !== "production") {
        _logger
            .remove(infoLevel)
            .add(debugLevel);
    }

    return _logger;
};



if (process.env.NODE_ENV !== "production") {
    logger().info("Not in production. Logging set as debugging");
}

export default logger;
