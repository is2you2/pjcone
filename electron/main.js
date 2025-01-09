const { app, BrowserWindow, Menu } = require('electron');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 720,
        minWidth: 300, // 최소 너비
        minHeight: 300, // 최소 높이
        webPreferences: {
            nodeIntegration: true
        }
    });

    // 메뉴를 비활성화
    Menu.setApplicationMenu(null);

    mainWindow.loadURL('https://is2you2.github.io/pjcone_pwa/');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Electron 앱이 준비되면 창을 생성
app.on('ready', createWindow);

// 모든 창이 닫히면 애플리케이션 종료
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
