import logging
import sys
import traceback

# Configure root logger before any import that might log
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

logger.info("=== Backend startup: importing Flask ===")

try:
    from flask import Flask
    logger.info("Flask imported OK")
except Exception:
    logger.critical("FAILED to import Flask:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from flask_cors import CORS
    logger.info("flask_cors imported OK")
except Exception:
    logger.critical("FAILED to import flask_cors:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from config import get_cors_allowed_origins
    logger.info("config imported OK")
except Exception:
    logger.critical("FAILED to import config:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.sessions import sessions_bp
    logger.info("routes.sessions imported OK")
except Exception:
    logger.critical("FAILED to import routes.sessions:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.tracker import tracker_bp
    logger.info("routes.tracker imported OK")
except Exception:
    logger.critical("FAILED to import routes.tracker:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.pinces import pinces_bp
    logger.info("routes.pinces imported OK")
except Exception:
    logger.critical("FAILED to import routes.pinces:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.query import query_bp
    logger.info("routes.query imported OK")
except Exception:
    logger.critical("FAILED to import routes.query:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.metadata import metadata_bp
    logger.info("routes.metadata imported OK")
except Exception:
    logger.critical("FAILED to import routes.metadata:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.kpis import kpis_bp
    logger.info("routes.kpis imported OK")
except Exception:
    logger.critical("FAILED to import routes.kpis:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.salle import salle_bp
    logger.info("routes.salle imported OK")
except Exception:
    logger.critical("FAILED to import routes.salle:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from kafka_consumer import start_consumer
    logger.info("kafka_consumer imported OK")
except Exception:
    logger.critical("FAILED to import kafka_consumer:\n%s", traceback.format_exc())
    sys.exit(1)

logger.info("=== All imports successful — creating Flask app ===")

import os
logger.info("Environment — NAS_SESSIONS_DIR=%s  MONGODB_URI=%s",
            os.environ.get("NAS_SESSIONS_DIR", "(not set)"),
            os.environ.get("MONGODB_URI", "(not set)"))

app = Flask(__name__)
CORS(
    app,
    resources={r"/api/*": {"origins": get_cors_allowed_origins()}},
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    expose_headers=["Content-Type"],
    supports_credentials=False,
    send_wildcard=True,
    max_age=86400,
)

app.register_blueprint(sessions_bp)
app.register_blueprint(tracker_bp)
app.register_blueprint(pinces_bp)
app.register_blueprint(query_bp)
app.register_blueprint(metadata_bp)
app.register_blueprint(kpis_bp)
app.register_blueprint(salle_bp)

logger.info("=== Blueprints registered — app ready ===")

# Start Kafka consumer background thread
start_consumer()


@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
