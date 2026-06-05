#!/usr/bin/env python3
"""Generate a bell icon as a PNG file and SVG favicon."""
import struct, zlib, math, sys, os

def create_png(width, height, data):
    """Create PNG from raw RGBA pixel data."""
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

def sd_ellipse(px, py, cx, cy, rx, ry):
    """Signed distance to an ellipse. Negative means inside."""
    dx = px - cx
    dy = py - cy
    return math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2) - 1.0

def sd_circle(px, py, cx, cy, r):
    dx = px - cx
    dy = py - cy
    return math.sqrt(dx * dx + dy * dy) - r

def sd_box(px, py, x1, y1, x2, y2):
    """Signed distance to an axis-aligned box."""
    dx = max(x1 - px, 0, px - x2)
    dy = max(y1 - py, 0, py - y2)
    return math.sqrt(dx * dx + dy * dy)

def inside_ring(px, py, cx, cy, r_outer, r_inner=None):
    d = math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
    if r_inner is None:
        return d <= r_outer, d - r_outer
    if d > r_outer:
        return False, d - r_outer
    if d < r_inner:
        return False, r_inner - d
    return True, min(d - r_inner, r_outer - d)

def generate_bell_pixels(size):
    """Generate RGBA pixel data for a bell icon."""
    cx = size * 0.5
    cy = size * 0.42  # Center of bell body
    
    # Bell dimensions (as fraction of size)
    dome_rx = 0.22
    dome_ry = 0.16
    body_narrow = 0.17  # Narrowest half-width
    body_bottom = 0.23  # Bottom half-width
    body_top_y = 0.28
    body_narrow_y = 0.55
    body_bottom_y = 0.78
    rim_thickness = 0.025
    clapper_radius = 0.028
    clapper_y = 0.85
    
    data = []
    
    # Primary color (purple from the app theme)
    r1, g1, b1 = 108, 99, 255
    # Accent (pinkish)
    r2, g2, b2 = 255, 107, 157
    
    for py in range(size):
        for px in range(size):
            # Normalize coordinates
            nx = (px - cx) / size
            ny = (py - cy * size) / size
            
            inside = False
            dist = 999.0
            color_r, color_g, color_b = 0, 0, 0
            
            # 1. Dome: bottom half of an ellipse
            if ny >= 0:
                d_dome = sd_ellipse(px, py, cx, cy - dome_ry * size * 0.3, dome_rx * size, dome_ry * size)
                if d_dome < 0:
                    # Check that we're in the bottom half of the ellipse
                    rel_y = (py - (cy - dome_ry * size * 0.3)) / (dome_ry * size)
                    if rel_y >= 0:
                        inside = True
                        dist = d_dome
                        t = (ny + 0.25) / 0.6
                        color_r = int(r1 + (r2 - r1) * t)
                        color_g = int(g1 + (g2 - g1) * t)
                        color_b = int(b1 + (b2 - b1) * t)
            
            # 2. Body: trapezoid that narrows then widens
            # Calculate the body boundaries at this y
            if ny > -0.02 and ny < 0.52:
                # Progress from top to narrow point
                if ny < 0.27:  # Top to narrow
                    progress = ny / 0.27  # 0 at top, 1 at narrow
                    half_w = dome_rx + (body_narrow - dome_rx) * progress
                else:  # Narrow to bottom
                    progress = (ny - 0.27) / 0.25  # 0 at narrow, 1 at bottom
                    half_w = body_narrow + (body_bottom - body_narrow) * progress
                
                left = cx - half_w * size
                right = cx + half_w * size
                
                # Add a slight curve to the sides
                side_curve = math.sin(ny * math.pi) * 0.008 * size
                
                if px >= left + side_curve and px <= right - side_curve:
                    inside = True
                    dist = min(px - left, right - px)
                    t = (ny + 0.1) / 0.55
                    color_r = int(r1 + (r2 - r1) * t)
                    color_g = int(g1 + (g2 - g1) * t)
                    color_b = int(b1 + (b2 - b1) * t)
            
            # 3. Bottom rim (thick curved bottom)
            rim_cy = body_bottom_y * size + cy - size * 0.42
            d_rim = sd_ellipse(px, py, cx, rim_cy, body_bottom * size, rim_thickness * size * 3)
            if d_rim < 0:
                inside = True
                dist = d_rim
                color_r, color_g, color_b = r1, g1, b1
            
            # 4. Sound hole (cutout in the bottom of the bell)
            hole_cy = rim_cy - rim_thickness * size * 1.5
            d_hole = sd_ellipse(px, py, cx, hole_cy, body_bottom * size * 0.55, rim_thickness * size * 2.5)
            if d_hole < 0:
                # Only cut out if we're also inside the body
                # Check if at bottom of bell
                inside = False
            
            # 5. Clapper
            d_clap = sd_circle(px, py, cx, clapper_y * size + cy - size * 0.42 + rim_thickness * size, clapper_radius * size)
            if d_clap < 0:
                inside = True
                dist = d_clap
            
            # 6. Clapper string (thin line from clapper to bell top)
            string_top = rim_cy - rim_thickness * size * 2.5
            string_bottom = clapper_y * size + cy - size * 0.42 + rim_thickness * size - clapper_radius * size
            if px >= cx - 2 and px <= cx + 2 and py >= string_bottom and py <= string_top:
                inside = True
            
            if inside:
                alpha = 255
                data.extend([color_r, color_g, color_b, alpha])
            else:
                data.extend([0, 0, 0, 0])
    
    return data

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    icons_dir = os.path.join(project_root, 'src-tauri', 'icons')
    public_dir = os.path.join(project_root, 'public')
    
    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)
    
    # Generate high-res PNG for Tauri icons
    size = 1024
    print(f"Generating {size}x{size} bell icon PNG...")
    data = generate_bell_pixels(size)
    png_data = create_png(size, size, data)
    
    output_path = os.path.join(icons_dir, 'icon_1024x1024.png')
    with open(output_path, 'wb') as f:
        f.write(png_data)
    print(f"Saved: {output_path}")
    
    # Also save as the main icon for direct use
    for name, sz in [('32x32.png', 32), ('128x128.png', 128), ('128x128@2x.png', 256), ('icon.png', 1024)]:
        if sz == size:
            data_small = data
        else:
            # Simple nearest-neighbor downscale
            data_small = []
            for py in range(sz):
                for px in range(sz):
                    sx = int(px * size / sz)
                    sy = int(py * size / sz)
                    idx = (sy * size + sx) * 4
                    data_small.extend(data[idx:idx+4])
            png_small = create_png(sz, sz, data_small)
        
        out = os.path.join(icons_dir, name)
        with open(out, 'wb') as f:
            if sz == size:
                f.write(png_data)
            else:
                f.write(png_small)
        print(f"Saved: {out}")
    
    # Generate SVG favicon
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bellGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#6c63ff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ff6b9d;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Bell dome -->
  <ellipse cx="256" cy="165" rx="100" ry="65" fill="url(#bellGrad)" />
  <!-- Bell body - trapezoid that narrows then widens -->
  <path d="M 156 165 L 170 280 Q 256 300 342 280 L 356 165 Z" fill="url(#bellGrad)" />
  <!-- Bell bottom rim -->
  <ellipse cx="256" cy="395" rx="110" ry="15" fill="#6c63ff" />
  <!-- Sound hole -->
  <ellipse cx="256" cy="385" rx="55" ry="10" fill="#0f0f1a" />
  <!-- Clapper -->
  <circle cx="256" cy="435" r="14" fill="#6c63ff" />
  <!-- Clapper string -->
  <line x1="256" y1="400" x2="256" y2="422" stroke="#6c63ff" stroke-width="3" />
</svg>'''
    
    svg_path = os.path.join(public_dir, 'vite.svg')
    with open(svg_path, 'w') as f:
        f.write(svg)
    print(f"Saved: {svg_path}")
    
    print("Done! All icons generated.")

if __name__ == '__main__':
    main()
