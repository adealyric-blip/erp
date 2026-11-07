#!/bin/bash
# Start dev server in a fully detached session
cd /home/z/my-project
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 2
rm -f dev.log
exec node node_modules/.bin/next dev -p 3000 > dev.log 2>&1
