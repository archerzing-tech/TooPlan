#!/usr/bin/env python3
"""Generate a redesigned modern app icon for TooPlan.
Creates a rounded-square icon with a purple-to-pink gradient background
and a sleek white checkmark symbol representing planning/task completion.
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


def distance_to_segment(px, py, x1, y1, x2, y2):
    """Distance from point (px,py) to line segment (x1,y1)-(x2,y2)."""
    dx = x2 - x1
    dy = y2 - y1
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_sq))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.sqrt((px - proj_x) ** 2 + (py - proj_y) ** 2)


def distance_to_polyline(px, py, points):
    """Distance from point to a polyline defined by points list."""
    min_dist = float('inf')
    for i in range(len(points) - 1):
        d = distance_to_segment(px, py, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])
        min_dist = min(min_dist, d)
    return min_dist


def sd_circle(px, py, cx, cy, r):
    """Signed distance to a circle centered at (cx, cy) with radius r."""
    return math.sqrt((px - cx) ** 2 + (py - cy) ** 2) - r


def render_checkmark_and_dot(px, py, check_pixels, thickness, accent_cx, accent_cy, accent_r):
    """Test if pixel (px, py) is inside the checkmark or accent dot."""
    dist_to_check = distance_to_polyline(px, py, check_pixels)
    in_check = dist_to_check < thickness * 0.5

    dx_a = px - accent_cx
    dy_a = py - accent_cy
    dist_to_accent = math.sqrt(dx_a * dx_a + dy_a * dy_a)
    in_accent = dist_to_accent < accent_r

    if in_check or in_accent:
        # Calculate anti-aliased alpha
        symbol_alpha = 255
        if in_check:
            edge_dist = thickness * 0.5 - dist_to_check
            if edge_dist < 1.5:
                symbol_alpha = int(255 * max(0, min(1, edge_dist / 1.5)))
        if in_accent:
            edge_dist = accent_r - dist_to_accent
            if edge_dist < 1.5:
                symbol_alpha = int(255 * max(0, min(1, edge_dist / 1.5)))
        return True, symbol_alpha
    return False, 0


def generate_icon_pixels(size, foreground_only=False):
    """Generate RGBA pixel data for the TooPlan app icon.

    If foreground_only is True, only the checkmark symbol is rendered on
    a transparent background (suitable for Android foreground layer).
    """
    cx = size * 0.5
    cy = size * 0.5

    # Brand colors
    purple_r, purple_g, purple_b = 108, 99, 255    # #6c63ff
    pink_r, pink_g, pink_b = 255, 107, 157         # #ff6b9d
    white_r, white_g, white_b = 255, 255, 255

    # Checkmark polyline points (normalized 0-1, relative to center)
    checkmark_points = [
        (0.28, 0.48),   # start (left side)
        (0.44, 0.64),   # bottom vertex
        (0.72, 0.32),   # end (top-right)
    ]

    # Convert to pixel coordinates
    check_pixels = [(cx + (x - 0.5) * size, cy + (y - 0.5) * size) for x, y in checkmark_points]

    # Checkmark thickness
    thickness = 0.072 * size

    # Decorative circle accent
    accent_cx = cx + (0.80 - 0.5) * size
    accent_cy = cy + (0.20 - 0.5) * size
    accent_r = 0.035 * size

    data = []

    for py in range(size):
        for px in range(size):
            if foreground_only:
                # Render only the symbol on transparent background
                in_sym, sym_alpha = render_checkmark_and_dot(px, py, check_pixels, thickness,
                                                              accent_cx, accent_cy, accent_r)
                if in_sym:
                    data.extend([white_r, white_g, white_b, sym_alpha])
                else:
                    data.extend([0, 0, 0, 0])
            else:
                # Rounded square background
                corner_radius = size * 0.22
                d = sd_rounded_box(px, py, cx, cy, size * 0.42, size * 0.42, corner_radius)

                if d > 0:
                    data.extend([0, 0, 0, 0])
                    continue

                # Gradient background
                progress_x = px / size
                progress_y = py / size
                t = (progress_x + progress_y) * 0.5
                t = smoothstep(0.15, 0.85, t)

                bg_r = int(purple_r + (pink_r - purple_r) * t)
                bg_g = int(purple_g + (pink_g - purple_g) * t)
                bg_b = int(purple_b + (pink_b - purple_b) * t)

                # Edge anti-aliasing for the rounded square
                alpha = 255
                if d > -1.5:
                    alpha = int(255 * max(0, min(1, 1 - (d + 1.5) / (-1.5))))

                in_sym, sym_alpha = render_checkmark_and_dot(px, py, check_pixels, thickness,
                                                              accent_cx, accent_cy, accent_r)
                if in_sym:
                    data.extend([white_r, white_g, white_b, min(alpha, sym_alpha)])
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
            result.extend(data[idx:idx + 4])
    return result


def save_png(data, size, path):
    """Generate and save a PNG file from RGBA pixel data."""
    png = create_png(size, size, data)
    with open(path, 'wb') as f:
        f.write(png)
    print(f"Saved: {path}")


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    icons_dir = os.path.join(project_root, 'src-tauri', 'icons')
    public_dir = os.path.join(project_root, 'public')
    android_gen = os.path.join(project_root, 'src-tauri', 'gen', 'android', 'app', 'src', 'main', 'res')

    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    # Generate high-res icon (1024x1024)
    size = 1024
    print(f"Generating {size}x{size} icon...")
    data_full = generate_icon_pixels(size)
    save_png(data_full, size, os.path.join(icons_dir, 'icon_1024x1024.png'))

    # Generate foreground-only for Android
    print("Generating foreground layer (Android)...")
    data_fg = generate_icon_pixels(size, foreground_only=True)

    # Generate various icon sizes
    icon_sizes = [
        ('32x32.png', 32),
        ('64x64.png', 64),
        ('128x128.png', 128),
        ('128x128@2x.png', 256),
        ('icon.png', 1024),
    ]

    for name, sz in icon_sizes:
        if sz == size:
            save_png(data_full, size, os.path.join(icons_dir, name))
        else:
            data_small = downscale(data_full, size, sz)
            save_png(data_small, sz, os.path.join(icons_dir, name))

    # Windows icons
    win_sizes = [
        ('Square30x30Logo.png', 30), ('Square44x44Logo.png', 44),
        ('Square71x71Logo.png', 71), ('Square89x89Logo.png', 89),
        ('Square107x107Logo.png', 107), ('Square142x142Logo.png', 142),
        ('Square150x150Logo.png', 150), ('Square284x284Logo.png', 284),
        ('Square310x310Logo.png', 310), ('StoreLogo.png', 50),
    ]
    for name, sz in win_sizes:
        data_small = downscale(data_full, size, sz)
        save_png(data_small, sz, os.path.join(icons_dir, name))

    # Android mipmap fallback PNGs (pre-API 26)
    # Density sizes: mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
    android_densities = [
        ('mdpi', 48), ('hdpi', 72), ('xhdpi', 96),
        ('xxhdpi', 144), ('xxxhdpi', 192),
    ]
    android_dir = os.path.join(android_gen, 'mipmap-{}')
    for density, sz in android_densities:
        icon_full_data = downscale(data_full, size, sz)
        icon_fg_data = downscale(data_fg, size, sz)

        mip_dir = android_dir.format(density)
        os.makedirs(mip_dir, exist_ok=True)

        # Regular launcher icon (full icon)
        save_png(icon_full_data, sz, os.path.join(mip_dir, 'ic_launcher.png'))
        # Round launcher icon (circular crop of full icon)
        save_png(icon_full_data, sz, os.path.join(mip_dir, 'ic_launcher_round.png'))
        # Foreground layer (just the symbol, transparent bg)
        save_png(icon_fg_data, sz, os.path.join(mip_dir, 'ic_launcher_foreground.png'))

    # Generate SVGs with coordinates matching the pixel rendering
    # Python normalized coords (center-relative) → SVG 512x512 viewport:
    #   SVG_x = (norm_x - 0.5) * 512 + 256
    # Checkmark: (0.28,0.48) → (143,246), (0.44,0.64) → (225,328), (0.72,0.32) → (369,164)
    # Accent dot: (0.80,0.20) → center (410,102), radius = 0.035 * 512 = 18
    svg_checkmark = "143,246 225,328 369,164"

    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6c63ff"/>
      <stop offset="100%" stop-color="#ff6b9d"/>
    </linearGradient>
  </defs>
  <rect x="42" y="42" width="428" height="428" rx="96" ry="96" fill="url(#bg)"/>
  <polyline points="''' + svg_checkmark + '''" fill="none" stroke="white" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="410" cy="102" r="18" fill="white"/>
</svg>'''

    with open(os.path.join(public_dir, 'vite.svg'), 'w') as f:
        f.write(svg)
    print(f"Saved: {os.path.join(public_dir, 'vite.svg')}")

    with open(os.path.join(icons_dir, 'icon.svg'), 'w') as f:
        f.write(svg)
    print(f"Saved: {os.path.join(icons_dir, 'icon.svg')}")

    # Update public/tauri.svg too
    with open(os.path.join(public_dir, 'tauri.svg'), 'w') as f:
        f.write(svg)
    print(f"Saved: {os.path.join(public_dir, 'tauri.svg')}")

    print("Done! All icons generated.")


if __name__ == '__main__':
    main()
