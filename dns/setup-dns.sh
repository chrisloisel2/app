#!/bin/bash
# =============================================================================
# setup-dns.sh — Génère dnsmasq.conf avec l'IP locale auto-détectée
# Usage : ./config/dns/setup-dns.sh [interface]
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/dnsmasq.conf.template"
OUTPUT="$SCRIPT_DIR/dnsmasq.conf"

# --- Détection de l'IP locale ---
detect_ip() {
    local iface="$1"

    if [ -n "$iface" ]; then
        # Interface spécifiée manuellement
        ip addr show "$iface" 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1
        return
    fi

    # Détection automatique : IP de la route par défaut (exclut loopback et docker)
    local ip
    ip=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\d+(\.\d+){3}' | head -1)

    if [ -z "$ip" ]; then
        # Fallback : première IP non-loopback, non-docker
        ip=$(ip addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '^127\.' | grep -v '^172\.' | head -1)
    fi

    echo "$ip"
}

SERVER_IP=$(detect_ip "${1:-}")

if [ -z "$SERVER_IP" ]; then
    echo "ERREUR : impossible de détecter l'IP du serveur." >&2
    echo "Usage : $0 [interface]  (ex: $0 eth0)" >&2
    exit 1
fi

echo "IP serveur détectée : $SERVER_IP"

# --- Génération de dnsmasq.conf ---
sed "s/SERVER_IP/$SERVER_IP/g" "$TEMPLATE" > "$OUTPUT"

echo "Fichier généré : $OUTPUT"
echo ""
echo "Pour démarrer le DNS :"
echo "  docker compose -f docker-compose-red.yml up -d dns"
echo ""
echo "Pour configurer les clients DNS sur le LAN, utiliser l'IP : $SERVER_IP"
