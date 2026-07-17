@echo off
REM Usage: SelectCopy.bat "InputFolder" "OutputFolder" "FileList.txt"

REM Check arguments
if "%~1"=="" (
    echo [ERROR] Missing input folder.
    goto :usage
)
if "%~2"=="" (
    echo [ERROR] Missing output folder.
    goto :usage
)
if "%~3"=="" (
    echo [ERROR] Missing file list.
    goto :usage
)

set "SRC=%~1"
set "DEST=%~2"
set "LIST=%~3"
set /a COUNT=0
set /a FAIL=0
set "FAILED_LIST="

REM Create destination folder if it does not exist
if not exist "%DEST%" (
    mkdir "%DEST%"
)

REM Loop through each line in the file list
for /f "usebackq tokens=*" %%F in ("%LIST%") do (
    echo Copying %%F ...
    copy /Y "%SRC%\%%F" "%DEST%\%%F" >nul
    if exist "%DEST%\%%F" (
        set /a COUNT+=1
    ) else (
        echo [FAILED] %%F could not be copied.
        set /a FAIL+=1
        set "FAILED_LIST=!FAILED_LIST! %%F"
    )
)

echo.
echo [INFO] Copy completed.
echo [INFO] %COUNT% file(s) successfully copied.

REM Safe check for failures
REM if not "%FAIL%"=="0" (
    echo [INFO] %FAIL% file(s) failed to copy:
REM     echo     %FAILED_LIST%
REM )

exit /b 0

:usage
echo.
echo Usage:
echo     SelectCopy.bat "InputFolder" "OutputFolder" "FileList.txt"
echo.
echo Example:
echo     SelectCopy.bat "D:\Testing\FolderA" "D:\Testing\FolderB" "D:\Testing\files.txt"
echo.
echo Note:
echo     "files.txt" is a text file containing filenames in FolderA
echo     that will be copied to FolderB.
echo.
exit /b 1
