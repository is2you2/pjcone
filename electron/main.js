const { app, BrowserWindow, Menu } = require('electron');

let mainWindow;

app.on('ready', () => {
    // 단일 인스턴스 보장
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
        app.quit(); // 이미 실행 중이면 종료
        return;
    }

    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 이미 실행 중인 애플리케이션에 새 인스턴스가 요청되었을 때 처리
        if (mainWindow) {
            // 창이 열린 상태라면 포커스를 주거나 동작을 정의
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // 메인 윈도우 생성
    mainWindow = new BrowserWindow({
        width: 450,
        height: 720,
        minWidth: 300, // 최소 너비
        minHeight: 300, // 최소 높이
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false,
        }
    });

    // 메뉴를 비활성화
    Menu.setApplicationMenu(null);

    mainWindow.loadURL('https://is2you2.github.io/pjcone_pwa/');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
});

// 모든 창이 닫히면 애플리케이션 종료
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
