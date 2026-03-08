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
    from routes.orchestrateur import orchestrateur_bp
    logger.info("routes.orchestrateur imported OK")
except Exception:
    logger.critical("FAILED to import routes.orchestrateur:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.operateurs import operateurs_bp
    logger.info("routes.operateurs imported OK")
except Exception:
    logger.critical("FAILED to import routes.operateurs:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.annotateurs import annotateurs_bp
    logger.info("routes.annotateurs imported OK")
except Exception:
    logger.critical("FAILED to import routes.annotateurs:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.scenarios import scenarios_bp
    logger.info("routes.scenarios imported OK")
except Exception:
    logger.critical("FAILED to import routes.scenarios:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from routes.kafka_logs import kafka_logs_bp, register_ws_route as register_kafka_logs_ws
    logger.info("routes.kafka_logs imported OK")
except Exception:
    logger.critical("FAILED to import routes.kafka_logs:\n%s", traceback.format_exc())
    sys.exit(1)

try:
    from kafka_consumer import start_consumer
    logger.info("kafka_consumer imported OK")
except Exception:
    logger.critical("FAILED to import kafka_consumer:\n%s", traceback.format_exc())
    sys.exit(1)


try:
    from flask_sock import Sock
    logger.info("flask_sock imported OK")
except Exception:
    logger.critical("FAILED to import flask_sock:\n%s", traceback.format_exc())
    sys.exit(1)

logger.info("=== All imports successful — creating Flask app ===")

import os
logger.info("Environment — NAS_SESSIONS_DIR=%s  MONGODB_URI=%s",
            os.environ.get("NAS_SESSIONS_DIR", "(not set)"),
            os.environ.get("MONGODB_URI", "(not set)"))

app = Flask(__name__)
sock = Sock(app)
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
app.register_blueprint(orchestrateur_bp)
app.register_blueprint(operateurs_bp)
app.register_blueprint(annotateurs_bp)
app.register_blueprint(scenarios_bp)
app.register_blueprint(kafka_logs_bp)

from routes.salle import register_ws_route
register_ws_route(sock)
register_kafka_logs_ws(sock)

logger.info("=== Blueprints registered — app ready ===")

# Start Kafka consumer background thread (topic2 — SalleReporter + KafkaEventPublisher)
start_consumer()


@app.before_request
def log_every_request():
    from flask import request as req
    logger.warning("REQ %s %s content_type=%r", req.method, req.path, req.content_type)


@app.errorhandler(Exception)
def handle_any_exception(e):
    logger.exception("GLOBAL UNHANDLED EXCEPTION")
    from flask import jsonify
    return jsonify({"ok": False, "error": "Erreur interne globale"}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
