#!/bin/bash
# Dev server daemon — keeps the server alive by respawning if it dies
cd /home/z/my-project
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 2
rm -f dev.log
while true; do
  node node_modules/.bin/next dev -p 3000 >> dev.log 2>&1
  echo "[$(date)] Server died, restarting in 3s..." >> dev.log
  sleep 3
done
