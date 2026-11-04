@echo off
if not exist bin\com\mochi\kitchen\Main.class (
    echo Binary not found, building first...
    call build.bat
)
java -cp bin com.mochi.kitchen.Main %*

