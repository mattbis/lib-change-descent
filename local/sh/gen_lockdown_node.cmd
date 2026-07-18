@echo off
rem gen_lockdown_node.cmd (`local/sh/`)
rem Windows boot wrapper generator for --frozen-intrinsics resident isolation.

set ENTRY=%~1
if "%ENTRY%"=="" set ENTRY=src-mjs.main/libcd_main.mjs

set OUT=%~2
if "%OUT%"=="" set OUT=local/sh/run_resident_locked.cmd

node "%~dp0..\tool\gen_lockdown_nodejs.mjs" --target windows --entry "%ENTRY%" --out "%OUT%"
