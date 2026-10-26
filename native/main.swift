import AppKit
import WebKit

// Let AppKit own the outer resize hit area instead of the embedded web view.
final class WindowContentView: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? {
        let localPoint = convert(point, from: superview)
        guard bounds.insetBy(dx: 4, dy: 4).contains(localPoint) else { return nil }
        return super.hitTest(point)
    }
}

// Minimal native host. Product UI stays in web/; only OS responsibilities live here.
final class LongtermismDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var quitInProgress = false
    private let devURL: URL? = (ProcessInfo.processInfo.environment["LONGTERMISM_DEV_URL"] ?? ProcessInfo.processInfo.environment["FIELD_DEV_URL"]).flatMap(URL.init(string:))
    // Stable identity and storage names preserve existing data and macOS preferences.
    private var development: Bool { Bundle.main.bundleIdentifier == "local.field.dev" }
    private var assets: URL { Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true) }
    private var dataDirectory: URL {
        let override = ProcessInfo.processInfo.environment["LONGTERMISM_DATA_DIR"] ?? ProcessInfo.processInfo.environment["FIELD_DATA_DIR"]
        if development, let path = override { return URL(fileURLWithPath: path, isDirectory: true) }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(development ? "field-development" : "field", isDirectory: true)
    }
    private var dataFile: URL { dataDirectory.appendingPathComponent("state.json") }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.applicationIconImage = NSImage(contentsOf: Bundle.main.resourceURL!.appendingPathComponent("longtermism.icns"))
        installMenu()
        let config = WKWebViewConfiguration()
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "longtermism")
        config.userContentController.addUserScript(WKUserScript(
            source: "window.LONGTERMISM_ENV = Object.freeze({development: \(development)});",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        if #available(macOS 13.3, *) { webView.isInspectable = development }
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1220, height: 880),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = development ? "longtermism — 开发版" : "longtermism"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .visible
        window.backgroundColor = NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                ? NSColor(srgbRed: 26/255, green: 26/255, blue: 30/255, alpha: 1)
                : NSColor(srgbRed: 244/255, green: 244/255, blue: 246/255, alpha: 1)
        }
        let content = WindowContentView(frame: NSRect(x: 0, y: 0, width: 1220, height: 880))
        webView.frame = content.bounds.insetBy(dx: 4, dy: 4)
        webView.autoresizingMask = [.width, .height]
        content.addSubview(webView)
        window.contentView = content
        window.contentMinSize = NSSize(width: 640, height: 480)
        window.contentResizeIncrements = NSSize(width: 1, height: 1)
        window.delegate = self
        window.isReleasedWhenClosed = false
        // Keep existing saved window geometry across the product rename.
        window.setFrameAutosaveName(development ? "FieldDevelopmentWindow" : "FieldWindow")
        if !window.setFrameUsingName(development ? "FieldDevelopmentWindow" : "FieldWindow") { window.center() }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        if development, let url = devURL, url.host == "127.0.0.1", url.scheme == "http" {
            webView.load(URLRequest(url: url))
        } else {
            webView.loadFileURL(assets.appendingPathComponent("index.html"), allowingReadAccessTo: assets)
        }
    }

    private func installMenu() {
        let root = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于 longtermism", action: #selector(about), keyEquivalent: "").target = self
        appMenu.addItem(withTitle: "记下一件事", action: #selector(newTask), keyEquivalent: "n").target = self
        appMenu.addItem(withTitle: "打开数据文件夹", action: #selector(revealData), keyEquivalent: "").target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "隐藏 longtermism", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "退出 longtermism", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        root.addItem(appItem)
        let edit = NSMenuItem()
        edit.submenu = NSMenu(title: "编辑")
        for (title, selector, key) in [("撤销", "undo:", "z"), ("剪切", "cut:", "x"), ("复制", "copy:", "c"), ("粘贴", "paste:", "v"), ("全选", "selectAll:", "a")] {
            edit.submenu?.addItem(withTitle: title, action: Selector(selector), keyEquivalent: key)
        }
        root.addItem(edit)
        let view = NSMenuItem()
        view.submenu = NSMenu(title: "显示")
        view.submenu?.addItem(withTitle: "刷新界面", action: #selector(reload), keyEquivalent: "r").target = self
        view.submenu?.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        root.addItem(view)
        NSApp.mainMenu = root
    }

    @objc private func about() {
        NSApp.orderFrontStandardAboutPanel(options: [.applicationName: "longtermism", .applicationVersion: "0.1.0", .credits: NSAttributedString(string: "行动矩阵 × 项目考察期\n本机保存，让生活一步一步清晰。")])
    }
    @objc private func newTask() {
        webView.evaluateJavaScript("if (window.longtermismReady && !document.querySelector('dialog').open) taskModal();", completionHandler: nil)
    }
    @objc private func revealData() {
        do {
            try FileManager.default.createDirectory(at: dataDirectory, withIntermediateDirectories: true)
            NSWorkspace.shared.open(dataDirectory)
        } catch { showError(error.localizedDescription) }
    }
    @objc private func reload() {
        flush { [weak self] success in if success { self?.webView.reload() } }
    }
    private func showError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "longtermism 暂时无法完成操作"
        alert.informativeText = message
        alert.runModal()
    }
    private func trusted(_ url: URL?) -> Bool {
        guard let url = url else { return false }
        if development, let dev = devURL {
            return url.scheme == "http" && url.host == "127.0.0.1" && url.port == dev.port
        }
        return url.isFileURL && url.standardizedFileURL.path.hasPrefix(assets.standardizedFileURL.path + "/")
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if trusted(url) { decisionHandler(.allow); return }
        // No remote page ever receives the filesystem bridge.
        if navigationAction.navigationType == .linkActivated, ["https", "http"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showError("无法加载界面。开发模式请确认 npm run dev 仍在运行。\n" + error.localizedDescription)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, trusted(message.frameInfo.request.url),
              let body = message.body as? [String: Any], let action = body["action"] as? String else {
            replyHandler(nil, "不允许的调用来源"); return
        }
        do {
            switch action {
            case "load":
                guard FileManager.default.fileExists(atPath: dataFile.path) else { replyHandler(NSNull(), nil); return }
                let bytes = try Data(contentsOf: dataFile)
                replyHandler(try JSONSerialization.jsonObject(with: bytes), nil)
            case "save":
                guard let value = body["value"] as? [String: Any], value["schemaVersion"] as? Int == 1,
                      value["plans"] is [Any], value["tasks"] is [Any] else {
                    replyHandler(nil, "数据格式不兼容"); return
                }
                let bytes = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
                guard bytes.count < 20_000_000 else { replyHandler(nil, "数据文件超过 20 MB"); return }
                try FileManager.default.createDirectory(at: dataDirectory, withIntermediateDirectories: true,
                                                       attributes: [.posixPermissions: 0o700])
                if FileManager.default.fileExists(atPath: dataFile.path) {
                    let previous = try Data(contentsOf: dataFile)
                    let backup = dataDirectory.appendingPathComponent("state.previous.json")
                    try previous.write(to: backup, options: .atomic)
                    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: backup.path)
                }
                try bytes.write(to: dataFile, options: .atomic)
                try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: dataFile.path)
                replyHandler(true, nil)
            default: replyHandler(nil, "未知操作")
            }
        } catch {
            NSLog("[longtermism] %@: %@", action, error.localizedDescription)
            replyHandler(nil, error.localizedDescription)
        }
    }
    private func flush(_ completion: @escaping (Bool) -> Void) {
        webView.callAsyncJavaScript("return window.longtermismFlush ? await window.longtermismFlush() : false;",
                                   arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value): completion((value as? Bool) == true)
            case .failure: completion(false)
            }
        }
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { NSApp.terminate(nil); return false }
    func windowDidResize(_ notification: Notification) {
        if development {
            NSLog("[longtermism] window resized: %.0f × %.0f", window.frame.width, window.frame.height)
        }
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if quitInProgress { return .terminateCancel }
        quitInProgress = true
        flush { [weak self] success in
            guard let self = self else { return }
            if success { NSApp.reply(toApplicationShouldTerminate: true); return }
            let alert = NSAlert()
            alert.messageText = "当前修改可能尚未保存"
            alert.informativeText = "可以返回窗口重试保存，也可以退出并放弃未保存的修改。"
            alert.addButton(withTitle: "返回窗口")
            alert.addButton(withTitle: "仍然退出")
            let quit = alert.runModal() == .alertSecondButtonReturn
            self.quitInProgress = false
            NSApp.reply(toApplicationShouldTerminate: quit)
        }
        return .terminateLater
    }
}

let app = NSApplication.shared
let delegate = LongtermismDelegate()
app.delegate = delegate
app.run()
