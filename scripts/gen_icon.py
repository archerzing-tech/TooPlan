#!/usr/bin/env python3
"""Generate a modern app icon for TooPlan.
Creates a rounded-square icon with a purple-to-pink gradient background
and a white "TP" monogram.
"""
import struct, zlib, math, os

def create_png(width, height, data):
    def chunk(ctype, cdata):
        c = ctype + cdata
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(cdata)) + c + crc
    raw = b''
    for y in range(height):
        raw += b'\x00'
        raw += bytes(data[y * width * 4:(y + 1) * width * 4])
    return (b'\x89PNG\r\n\x1a\n' +
            chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) +
            chunk(b'IDAT', zlib.compress(raw)) +
            chunk(b'IEND', b''))

def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)

def sd_rounded_box(px, py, cx, cy, w, h, r):
    """Signed distance to a rounded box centered at (cx, cy) with half-width w, half-height h, corner radius r."""
    dx = abs(px - cx) - w + r
    dy = abs(py - cy) - h + r
    if dx < 0 and dy < 0:
        return -min(w - abs(px - cx), h - abs(py - cy))
    return math.sqrt(max(dx, 0) ** 2 + max(dy, 0) ** 2) - r

def generate_icon_pixels(size):
    """Generate RGBA pixel data for a modern TooPlan app icon."""
    cx = size * 0.5
    cy = size * 0.5

    # Colors
    purple_r, purple_g, purple_b = 108, 99, 255    # #6c63ff
    pink_r, pink_g, pink_b = 255, 107, 157         # #ff6b9d
    white_r, white_g, white_b = 255, 255, 255

    data = []

    for py in range(size):
        for px in range(size):
            # Rounded square (superellipse for smoother corners)
            corner_radius = size * 0.22
            d = sd_rounded_box(px, py, cx, cy, size * 0.42, size * 0.42, corner_radius)

            if d > 0:
                # Outside the icon - transparent
                data.extend([0, 0, 0, 0])
                continue

            # Inside the icon - gradient background
            # Gradient from top-left (purple) to bottom-right (pink)
            progress_x = px / size
            progress_y = py / size
            t = (progress_x + progress_y) * 0.5

            # Ease the gradient
            t = smoothstep(0.15, 0.85, t)

            bg_r = int(purple_r + (pink_r - purple_r) * t)
            bg_g = int(purple_g + (pink_g - purple_g) * t)
            bg_b = int(purple_b + (pink_b - purple_b) * t)

            # Antialiasing on edges
            alpha = 255
            if d > -1.5:
                alpha = int(255 * max(0, min(1, 1 - (d + 1.5) / (-1.5))))

            # Draw "TP" monogram
            # We use a simple approach: detect if pixel is inside the letter shapes
            # Normalize coordinates relative to center (0-1 range, centered)
            nx = (px - cx) / size  # -0.5 to 0.5
            ny = (py - cy) / size  # -0.5 to 0.5

            in_letter = False
            letter_color = (white_r, white_g, white_b)

            # "T" letter (left side)
            # Horizontal bar (top of T)
            t_left = -0.22
            t_right = -0.02
            t_top = -0.28
            t_bar_bottom = -0.18

            # Vertical stem (middle of T)
            v_left = -0.14
            v_right = -0.04
            v_top = -0.18
            v_bottom = 0.20

            if (nx >= t_left and nx <= t_right and ny >= t_top and ny <= t_bar_bottom) or \
               (nx >= v_left and nx <= v_right and ny >= v_top and ny <= v_bottom):
                in_letter = True

            # "P" letter (right side)
            # Vertical stem
            p_stem_left = 0.04
            p_stem_right = 0.12
            p_stem_top = -0.28
            p_stem_bottom = 0.20

            # Upper curve of P (top-right part)
            p_curve_cx = 0.12
            p_curve_cy = -0.08
            p_curve_rx = 0.10
            p_curve_ry = 0.14

            # Check if pixel is inside the P
            in_p_stem = (nx >= p_stem_left and nx <= p_stem_right and ny >= p_stem_top and ny <= p_stem_bottom)

            # For the P curve, use a filled ellipse approach
            dx_p = (nx - p_curve_cx) / p_curve_rx
            dy_p = (ny - p_curve_cy) / p_curve_ry
            d_p = dx_p * dx_p + dy_p * dy_p

            # The P curve: inside the ellipse, to the right of the stem, above the stem bottom
            in_p_curve = d_p <= 1.0 and nx >= p_stem_right and ny <= p_stem_bottom - 0.02

            # Cut out the inner part of P (the hole)
            p_hole_cx = 0.15
            p_hole_cy = -0.06
            p_hole_rx = 0.055
            p_hole_ry = 0.085
            dx_h = (nx - p_hole_cx) / p_hole_rx
            dy_h = (ny - p_hole_cy) / p_hole_ry
            d_h = dx_h * dx_h + dy_h * dy_h
            in_p_hole = d_h <= 1.0 and nx >= p_stem_right

            if (in_p_stem or in_p_curve) and not in_p_hole:
                in_letter = True

            if in_letter:
                # Smooth edges of letters
                data.extend([white_r, white_g, white_b, alpha])
            else:
                data.extend([bg_r, bg_g, bg_b, alpha])

    return data

def downscale(data, src_size, dst_size):
    """Simple nearest-neighbor downscale."""
    result = []
    for py in range(dst_size):
        for px in range(dst_size):
            sx = int(px * src_size / dst_size)
            sy = int(py * src_size / dst_size)
            idx = (sy * src_size + sx) * 4
            result.extend(data[idx:idx+4])
    return result

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    icons_dir = os.path.join(project_root, 'src-tauri', 'icons')
    public_dir = os.path.join(project_root, 'public')

    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    # Generate high-res icon
    size = 1024
    print(f"Generating {size}x{size} icon...")
    data = generate_icon_pixels(size)
    png_data = create_png(size, size, data)

    output_path = os.path.join(icons_dir, 'icon_1024x1024.png')
    with open(output_path, 'wb') as f:
        f.write(png_data)
    print(f"Saved: {output_path}")

    # Generate various icon sizes
    sizes = [
        ('32x32.png', 32),
        ('64x64.png', 64),
        ('128x128.png', 128),
        ('128x128@2x.png', 256),
        ('icon.png', 1024),
    ]

    for name, sz in sizes:
        if sz == size:
            png_small = png_data
        else:
            data_small = downscale(data, size, sz)
            png_small = create_png(sz, sz, data_small)

        out = os.path.join(icons_dir, name)
        with open(out, 'wb') as f:
            f.write(png_small)
        print(f"Saved: {out}")

    # Generate Windows icons (Square logos)
    for name, sz in [('Square30x30Logo.png', 30), ('Square44x44Logo.png', 44),
                      ('Square71x71Logo.png', 71), ('Square89x89Logo.png', 89),
                      ('Square107x107Logo.png', 107), ('Square142x142Logo.png', 142),
                      ('Square150x150Logo.png', 150), ('Square284x284Logo.png', 284),
                      ('Square310x310Logo.png', 310), ('StoreLogo.png', 50)]:
        data_small = downscale(data, size, sz)
        png_small = create_png(sz, sz, data_small)
        out = os.path.join(icons_dir, name)
        with open(out, 'wb') as f:
            f.write(png_small)
        print(f"Saved: {out}")

    # Generate SVG favicon
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6c63ff"/>
      <stop offset="100%" stop-color="#ff6b9d"/>
    </linearGradient>
  </defs>
  <!-- Background rounded square -->
  <rect x="42" y="42" width="428" height="428" rx="96" ry="96" fill="url(#bgGrad)"/>    <!-- T letter -->
  <path d="M 130 140 h 90 v 20 h -35 v 200 h -20 v -200 h -35 z" fill="white"/>
  <!-- P letter -->
  <path d="M 260 140 h 80 a 55 55 0 1 1 0 100 h -60 v 120 h -20 z" fill="white"/>
</svg>'''

    svg_path = os.path.join(public_dir, 'vite.svg')
    with open(svg_path, 'w') as f:
        f.write(svg)
    print(f"Saved: {svg_path}")

    # Also save a cleaner SVG for the app header
    header_svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGradH" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6c63ff"/>
      <stop offset="100%" stop-color="#ff6b9d"/>
    </linearGradient>
  </defs>
  <rect x="42" y="42" width="428" height="428" rx="96" ry="96" fill="url(#bgGradH)"/>
  <path d="M 130 140 h 90 v 20 h -35 v 200 h -20 v -200 h -35 z" fill="white"/>
  <path d="M 260 140 h 80 a 55 55 0 1 1 0 100 h -60 v 120 h -20 z" fill="white"/>
</svg>'''

    header_svg_path = os.path.join(icons_dir, 'icon.svg')
    with open(header_svg_path, 'w') as f:
        f.write(header_svg)
    print(f"Saved: {header_svg_path}")

    print("Done! All icons generated.")

if __name__ == '__main__':
    main()
