#!/bin/bash
pm2 start "pnpm run preview" --name voice-visualizer # port는 vite.config.ts에서 설정함.
pm2 start "lt --port 8001 --subdomain voice-visualizer" --name voice-visualizer-lt
