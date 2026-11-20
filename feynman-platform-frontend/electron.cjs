// electron.cjs —— Electron 主进程（第十五次课）
// 为什么是 .cjs：前端 package.json 里 "type": "module"，
// 而 Electron 主进程教案用的是 CommonJS（require），.cjs 后缀强制按 CJS 解析。
//
// 主进程 = 应用的"大脑"：拥有完整 Node.js 环境，负责创建窗口、菜单、生命周期。
// 渲染进程 = Chromium 里跑的 React 应用，不能直接碰 Node API，需要时走 IPC。
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // 渲染进程禁用 Node，安全
      contextIsolation: true, // 上下文隔离，preload 桥接才安全
    },
  });

  if (process.env.ELECTRON_START_URL) {
    // 开发模式：加载 Vite 开发服务器（热更新），并打开 DevTools
    win.loadURL(process.env.ELECTRON_START_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // 生产模式：加载打包后的静态文件（vite base:'./' 保证资源用相对路径）
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// ---------- 挑战作业：原生顶部菜单栏（文件→退出，帮助→关于） ----------
const menuTemplate = [
  {
    label: '文件',
    submenu: [
      { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
      { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
    ],
  },
  {
    label: '帮助',
    submenu: [
      {
        label: '关于',
        click: () =>
          dialog.showMessageBox({
            title: '关于',
            message: '费曼学习平台（桌面版）',
            detail:
              '《大前端与AI实战》课程项目\n技术栈：React + Vite + Express + MongoDB + AI + Three.js + Electron\n当前 Electron 版本：' +
              process.versions.electron,
          }),
      },
      {
        label: '项目仓库',
        click: () => shell.openExternal('https://github.com/Celeste-f/feynman-platform'),
      },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 习惯：关完窗口不退出；其他平台直接退出
  if (process.platform !== 'darwin') app.quit();
});
