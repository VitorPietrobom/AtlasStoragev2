import CoreImage
import CoreImage.CIFilterBuiltins
import ExpoModulesCore
import UIKit
import Vision

/// Finds the foreground object in a photo, cuts it out and adds a white
/// die-cut border, writing a transparent PNG. Runs fully on device.
@ExpoModule("AtlasCutout")
public class AtlasCutoutModule: Module {
  @JS
  nonisolated func isSupported() -> Bool {
    if #available(iOS 17.0, *) { return true }
    return false
  }

  /// Returns the written file URI, or "" when no subject was found.
  @JS(.concurrent)
  func cutOutAsync(sourceUri: String, outputUri: String) async throws -> String {
    guard #available(iOS 17.0, *) else { return "" }
    return try Cutter.run(sourceUri: sourceUri, outputUri: outputUri)
  }
}

struct CutoutException: Error, CustomStringConvertible {
  let description: String
}

@available(iOS 17.0, *)
enum Cutter {
  /// Longest side of the working image; stickers never need more.
  static let maxSide: CGFloat = 1400

  static func run(sourceUri: String, outputUri: String) throws -> String {
    guard let source = fileURL(sourceUri), let output = fileURL(outputUri) else {
      throw CutoutException(description: "Bad file URI")
    }
    guard let loaded = UIImage(contentsOfFile: source.path), let upright = normalized(loaded),
      let cg = upright.cgImage
    else {
      throw CutoutException(description: "Could not read the photo")
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cg, orientation: .up)
    try handler.perform([request])
    guard let observation = request.results?.first, !observation.allInstances.isEmpty else { return "" }
    let maskBuffer = try observation.generateScaledMaskForImage(forInstances: observation.allInstances, from: handler)

    let original = CIImage(cgImage: cg)
    let extent = original.extent
    let mask = CIImage(cvPixelBuffer: maskBuffer)

    // White border: grow the mask by a few points and fill it white under the subject.
    let borderPx = max(6, extent.width * 0.014)
    let grow = CIFilter.morphologyMaximum()
    grow.inputImage = mask.clampedToExtent()
    grow.radius = Float(borderPx)
    guard let grown = grow.outputImage?.cropped(to: extent) else { return "" }
    let soften = CIFilter.gaussianBlur()
    soften.inputImage = grown.clampedToExtent()
    soften.radius = 1.2
    let borderMask = (soften.outputImage ?? grown).cropped(to: extent)

    let clear = CIImage(color: .clear).cropped(to: extent)
    let white = CIImage(color: .white).cropped(to: extent)

    let border = CIFilter.blendWithMask()
    border.inputImage = white
    border.backgroundImage = clear
    border.maskImage = borderMask

    let subject = CIFilter.blendWithMask()
    subject.inputImage = original
    subject.backgroundImage = clear
    subject.maskImage = mask

    guard let borderImage = border.outputImage, let subjectImage = subject.outputImage else { return "" }
    let composed = subjectImage.composited(over: borderImage)

    // Crop to the border plus a little air for the drop shadow.
    guard let box = opaqueBounds(maskBuffer, grownBy: borderPx + 4, within: extent) else { return "" }
    let cropped = composed.cropped(to: box).transformed(by: CGAffineTransform(translationX: -box.minX, y: -box.minY))

    let context = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
    guard let png = context.pngRepresentation(of: cropped, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!) else {
      throw CutoutException(description: "Could not encode the sticker")
    }
    try png.write(to: output, options: .atomic)
    return output.absoluteString
  }

  static func fileURL(_ uri: String) -> URL? {
    if uri.hasPrefix("file://") { return URL(string: uri) }
    return URL(fileURLWithPath: uri)
  }

  /// Redraw upright (EXIF orientation applied) and no larger than maxSide.
  static func normalized(_ image: UIImage) -> UIImage? {
    let scale = min(1, maxSide / max(image.size.width, image.size.height))
    let size = CGSize(width: floor(image.size.width * scale), height: floor(image.size.height * scale))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
  }

  /// Bounding box of the mask (in Core Image coordinates, origin bottom-left), grown by a margin.
  static func opaqueBounds(_ buffer: CVPixelBuffer, grownBy margin: CGFloat, within extent: CGRect) -> CGRect? {
    CVPixelBufferLockBaseAddress(buffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
    let width = CVPixelBufferGetWidth(buffer)
    let height = CVPixelBufferGetHeight(buffer)
    let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
    var minX = width, minY = height, maxX = -1, maxY = -1
    // The scaled mask is one 32-bit float per pixel.
    for y in stride(from: 0, to: height, by: 2) {
      let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
      for x in stride(from: 0, to: width, by: 2) where row[x] > 0.5 {
        if x < minX { minX = x }
        if x > maxX { maxX = x }
        if y < minY { minY = y }
        if y > maxY { maxY = y }
      }
    }
    guard maxX >= minX, maxY >= minY else { return nil }
    // Pixel rows run top-down; Core Image's y axis runs bottom-up.
    let rect = CGRect(
      x: CGFloat(minX),
      y: CGFloat(height - 1 - maxY),
      width: CGFloat(maxX - minX + 1),
      height: CGFloat(maxY - minY + 1)
    )
    return rect.insetBy(dx: -margin, dy: -margin).intersection(extent).integral
  }
}
