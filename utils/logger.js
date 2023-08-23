const winston = require("winston");
const { createLogger, transports, format } = winston;

const {
  timestamp: timestampFn,
  combine,
  printf,
  colorize,
  prettyPrint,
} = format;

// Format function
const myFormat = printf(
  ({ level, message, timestamp }) => `${timestamp}: ${level}----> ${message} `
);

const logger = createLogger({
  format: combine(colorize(), timestampFn(), prettyPrint(), myFormat),
  silent: process.env.NODE_ENV === "test",
});

logger.add(new transports.Console());

winston.addColors({
  error: "bold red",
  warn: "bold yellow",
  info: "bold cyan",
  debug: "bold green",
});
logger.on("error", (err) => console.error(err.message));

module.exports = logger;

const formatLog = (req, message) => {
  return `[${req.method} ${req.originalUrl}] ${message}`;
};

module.exports = {
  formatLog,
};
