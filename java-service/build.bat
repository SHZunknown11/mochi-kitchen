@echo off
echo Compiling Mochi Kitchen Java Engine...
if not exist bin mkdir bin
javac -d bin -sourcepath src\main\java src\main\java\com\mochi\kitchen\Main.java
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo Build successful! Run run.bat to start the Java service.
    echo ========================================================
) else (
    echo Build failed.
)

