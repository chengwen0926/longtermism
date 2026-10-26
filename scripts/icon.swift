import AppKit

// Render the same vector mark used by the sidebar and browser into macOS icons.
let source = URL(fileURLWithPath: CommandLine.arguments[1])
let destination = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let svg = try String(contentsOf: source, encoding: .utf8)
let artwork = svg.replacingOccurrences(of: "width=\"24\" height=\"24\"", with: "width=\"1024\" height=\"1024\"")
guard let mark = NSImage(data: Data(artwork.utf8)) else {
    fatalError("Cannot load rocket.svg")
}
try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let extent = CGFloat(pixels)
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        NSGraphicsContext.current?.imageInterpolation = .high
        NSColor(srgbRed: 35/255, green: 35/255, blue: 39/255, alpha: 1).setFill()
        NSBezierPath(roundedRect: NSRect(x: extent * 0.06, y: extent * 0.06,
            width: extent * 0.88, height: extent * 0.88),
            xRadius: extent * 0.20, yRadius: extent * 0.20).fill()
        mark.draw(in: NSRect(x: extent * 0.19, y: extent * 0.19,
            width: extent * 0.62, height: extent * 0.62))
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 2 ? "@2x" : ""
        try bitmap.representation(using: .png, properties: [:])!
            .write(to: destination.appendingPathComponent("icon_\(size)x\(size)\(suffix).png"))
    }
}
