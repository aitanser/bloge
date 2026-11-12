#!/bin/bash
echo -e "\033[36m=========================================\033[0m"
echo -e "\033[36m     Hongzhu Space - Backend Launcher\033[0m"
echo -e "\033[36m=========================================\033[0m"
echo ""
if ! command -v node &> /dev/null; then
    echo -e "\033[31m[ERROR] Node.js not found. Please install Node.js first.\033[0m"
    exit 1
fi
echo "Starting server..."
node server.js
