# 个人所得税 · iOS 版（H5 外壳）

把 Android WebView 版的「个人所得税」H5 页面，原封不动装进一个 iOS 原生外壳里。
**H5 一行没改**，只写了 3 个 Swift 文件。

```
Android WebView 壳 + assets/*.html
        ↓  换壳（H5 不动）
iOS WKWebView 壳 + WebApp/*.html
        ↓
GitHub Actions 免费 macOS 编译 → 未签名 .ipa → 全能签签名安装
```

---

## 一、这个工程做了什么

| 层 | 原 Android 版 | 本 iOS 版 |
|---|---|---|
| 外壳 | Android WebView 加载 `file:///android_asset/*.html` | **WKWebView + 自定义 scheme** 加载 `taxapp://localhost/*.html` |
| 页面 | 37 个 html | **逐字节相同**（`WebApp/` 目录） |
| 数据层 | `js/local_api.js` 拦截 `fetch`/`XHR` → localStorage | **同一份文件，没改** |
| 税额引擎 | 累计预扣法（TCA）纯 JS | **同一份文件，没改** |
| 原生代码 | Java/Kotlin（资料包里没有） | 3 个 Swift 文件，共 348 行 |

### 为什么用自定义 scheme 而不是 `file://`

这是本工程**唯一一处非平凡的移植决策**。

WKWebView 在 `file://` 协议下会拒绝 `fetch`/`XMLHttpRequest` 读取同目录资源。
本项目有 19 处 `fetch`/XHR 调用，其中大部分被 `local_api.js:424` 和 `:434` 拦下了，
但有**两处不在拦截表里**：

- `gerenxinxi.html:874` → `fetch('/js/pca.json')`
- `js/theme-loader.js:232` → `fetch('/api/public/mine-ui')`

走 `file://` 这两个会**静默失败**（不报错、不弹窗，功能悄悄坏掉）。
改用 `WKURLSchemeHandler` 注册 `taxapp://` 后，走的是正常 URL 语义，不会失败。

### 资源放在 Documents，不在 bundle 里直接读

首次启动把 bundle 里的 `WebApp/` 复制到 `Documents/WebApp/`，之后都从那里读。
**好处**：以后要改页面，直接替换 `Documents/WebApp` 里的文件即可，
不用重新编译、不用重新签名安装。

---

## 二、操作流程

### 改页面 → 出包

```powershell
# 1) 从 D 盘构建源同步 H5（自动排除 *.bak / *.orig / _selfcheck / tools）
.\sync_h5.ps1

# 2) 自检（不用 Mac 也能跑）
python .\verify_project.py

# 3) 出包：上传 GitHub → 云端编译 → 下载 IPA 到 out\
$env:GH_TOKEN = "ghp_xxx"; .\ship.ps1
```

或者直接双击 `一键出包.bat`。

### 产物

```
D:\dsh-scratch\ios-tax\out\个人所得税-unsigned-macos-15.ipa
D:\dsh-scratch\ios-tax\out\个人所得税-unsigned-macos-14.ipa
```

两个镜像并行编译，内容一样，任选一个。**都是未签名包**，交给全能签。

### 装到手机

1. 把 IPA 传到手机
2. 全能签 → 导入 IPA → 签名（Bundle ID 用 `com.example.geshui` 或让它自动分配）
3. 装好后若提示不受信任：**设置 → 通用 → VPN与设备管理** → 信任证书

---

## 三、工程结构

```
iPhoneTax\
├─ .github/workflows/build-ipa.yml          # 云端编译（macOS，双镜像并行）
├─ iPhoneTax.xcodeproj/
│  ├─ project.pbxproj                       # 手写工程文件
│  └─ xcshareddata/xcschemes/iPhoneTax.xcscheme    ← 注意是 xcschemes
└─ iPhoneTax/
   ├─ TaxApp.swift                          # @main 入口（18 行）
   ├─ WebContainerView.swift                # WKWebView 容器 + 左边缘返回手势（158 行）
   ├─ WebAssetSchemeHandler.swift           # taxapp:// 资源服务（172 行）
   ├─ Info.plist                            # 中文件名、仅竖屏、ATS 放行、相册权限
   ├─ iPhoneTax.entitlements
   ├─ zh-Hans.lproj/InfoPlist.strings       # 中文应用名
   ├─ Assets.xcassets/AppIcon.appiconset/    # 1024×1024 图标
   └─ WebApp/                                # ← H5 资源（122 个文件 7.00 MB，由 sync_h5.ps1 生成）
```

---

## 四、已做的 iOS 适配（都是代码里写死的，不用你管）

| 项 | 处理 | 位置 |
|---|---|---|
| `fetch` 在 `file://` 下被拦 | 改用自定义 scheme `taxapp://` | `WebAssetSchemeHandler.swift` |
| 中文文件名 | URL 百分号解码后查表 | `WebAssetSchemeHandler.swift:resolveRelativePath` |
| MIME 类型 | 手写扩展名映射表（未知 scheme 不会自动猜，猜错会白屏） | `WebAssetSchemeHandler.swift:mimeMap` |
| `login.html:645` 的 `http://175.24.180.44:8080` 跳转 | 用 Safari 打开，不顶掉 App | `WebContainerView.swift:decidePolicyFor` |
| ATS 阻止明文 HTTP | Info.plist 放行该域名 + `NSAllowsArbitraryLoads` | `Info.plist` |
| `<input type="file" accept="image/*">` | Info.plist 加 `NSPhotoLibraryUsageDescription` | `Info.plist` |
| 横屏 | 锁竖屏（原页面只有 3 处横屏适配） | `Info.plist:UISupportedInterfaceOrientations` |
| iOS 左边缘右滑手势与 `shuiming.html` 的 `scroll-snap` 抢手势 | 关掉系统手势，改成自带识别器调 `goBack()` | `WebContainerView.swift` |
| 深色模式串色 | 固定浅色 | `TaxApp.swift:.preferredColorScheme(.light)` |
| 系统状态栏 | 隐藏（H5 自带顶栏） | `TaxApp.swift` + `Info.plist` |
| `js/apple.js` | 那是 **DisableDevtool v0.3.7**（与 Apple 无关），在 WKWebView 里探测器不会触发，保留原样 | — |

---

## 五、已知风险 / 待真机确认

| 风险 | 说明 | 应对 |
|---|---|---|
| **像素级布局差异** | Android WebView 与 iOS Safari 的 `innerWidth` 差 30–40 CSS 像素。用户要求「一个 UI 不差」，这条在真机上必然有偏移 | 先看真机，再决定要不要注入固定宽度 viewport |
| 中文文件名资源 | Scheme handler 已做解码，但 `WebApp` 里若有中文名文件需真机确认 | 自检脚本会列出非 ASCII 文件名 |
| 文件选择框 | `help_center.html` / `ui_editor.js` 的图片选择走系统相册，权限已声明 | 真机点一下确认 |
| 首次启动复制 7 MB | 从 bundle 复制到 Documents，约 0.1–0.5 秒，会多一次启动等待 | 可接受；若嫌慢可改为直接读 bundle |
| 未签名包无法上架 | 自签限定，7 天或掉签需重签 | 与 Android 版同理 |

---

## 六、改工程时注意（手写 pbxproj 的坑）

加新 `.swift` 文件必须补**三处**引用，缺一不报错但文件不进包：

1. `PBXFileReference`
2. `PBXBuildFile`
3. `PBXSourcesBuildPhase`（资源文件则是 `PBXResourcesBuildPhase`）

其它固定规则：

- scheme 目录必须是 `xcshareddata/xcschemes/`（写成 `xschemes` 会报 "does not contain a scheme named"）
- `WebApp` 必须以 **folder reference**（`lastKnownFileType = folder`）存在，否则目录会被打散
- 本地化字符串要用 `PBXVariantGroup`，直接挂 `PBXFileReference` 不生效
- `verify_project.py` 会把这些都检查一遍

---

## 七、常用命令

```powershell
# 只演练不写入
.\sync_h5.ps1 -WhatIf

# 换 H5 源目录
.\sync_h5.ps1 -Src "D:\别的路径\assets"

# 自检
python D:\dsh-scratch\ios-tax\verify_project.py

# 出包
$env:GH_TOKEN="ghp_xxx"; D:\dsh-scratch\ios-tax\ship.ps1
```
