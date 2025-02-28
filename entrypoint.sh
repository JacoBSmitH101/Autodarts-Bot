#!/bin/sh

# Kubernetes uses DNS-based service discovery. This will check how many pods are running.
ACTIVE_PODS=$(kubectl get pods -l app=discord-bot-dev --field-selector=status.phase=Running | grep -v NAME | wc -l)

if [ "$ACTIVE_PODS" -lt "2" ]; then
    echo "🚀 This pod is the active leader! Starting Discord bot..."
    exec pm2 start index.js  # Start the bot only on the leader pod
else
    echo "⏳ Standby mode: Another pod is already active. Waiting for failover..."
    sleep infinity  # Keep the container alive without running the bot
fi
