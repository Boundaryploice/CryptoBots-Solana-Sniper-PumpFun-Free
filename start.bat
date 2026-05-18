@echo off
title Solana Sniping Bot
@echo Verifying dependencies...
call npm install --no-fund --no-audit
cls
call npm run start
pause
