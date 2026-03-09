import os

# NAS (NFS mount in container)
# Structure: <NAS_SESSIONS_DIR>/session_<id>/{tracker_positions.csv, pince1_data.csv, pince2_data.csv, metadata.json}
NAS_SESSIONS_DIR = os.environ.get("NAS_SESSIONS_DIR", "/nas/sessions")
NAS_HOST         = os.environ.get("NAS_HOST", "192.168.88.248")
NAS_PORT         = int(os.environ.get("NAS_PORT", "22"))
NAS_USER         = os.environ.get("NAS_USER", "EXORIA")
NAS_PASS         = os.environ.get("NAS_PASS", "")

# Kafka (external broker)
KAFKA_BROKER      = os.environ.get("KAFKA_BROKER", "192.168.88.4")
KAFKA_BROKER_PORT = int(os.environ.get("KAFKA_BROKER_PORT", "9092"))
KAFKA_TOPIC       = os.environ.get("KAFKA_TOPIC", "monitoring")

# MongoDB (external instance)
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://admin:admin123@192.168.88.17:27017/")


def get_cors_allowed_origins():
    raw = os.environ.get("CORS_ALLOWED_ORIGINS", "*").strip()
    if raw == "*" or raw == "":
        return "*"
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
