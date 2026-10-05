# Sparkplug controller model for Blender 4.x
#
# Builds the Sparkplug enclosure and its control caps, then exports:
#   sparkplug-enclosure.stl  top shell, print it upside down (open side up)
#   sparkplug-knob.stl       one knob cap (print 3)
#   sparkplug-ignite.stl     the dome cap for the Ignite button (the hemisphere)
#   sparkplug-assembly.stl   everything together, for previewing only
# and renders preview images (WebP) into ../images/.
#
# Run from this folder:
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python sparkplug.py
#
# All sizes are millimetres. Change the numbers in SETTINGS and re-run.

import math
import os

import bmesh
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
IMAGES = os.path.join(HERE, "..", "images")

# ---------------- SETTINGS ----------------
BODY_W = 240          # width (left to right); fits a 256 mm printer bed
BODY_D = 140          # depth (front to back)
BODY_H = 45           # height
CORNER_R = 18         # rounded corner radius
WALL = 3              # side wall thickness
TOP = 3               # top plate thickness

JOYSTICK = {"pos": (-88, -4), "hole_d": 30, "ring_d": 46, "ring_h": 3}
KNOBS = {"y": 40, "xs": (-36, 0, 36), "shaft_d": 7.5, "cap_d": 24, "cap_h": 18}
IGNITE = {"pos": (0, -20), "hole_d": 60, "dome_r": 32}
BUTTONS = {"pos": [(76, 16), (106, 16), (76, -16), (106, -16)], "hole_d": 24, "cap_d": 24, "cap_h": 8}
BOSS = {"d": 9, "hole_d": 3, "inset": 14}   # screw posts in each corner
USB = {"w": 13, "h": 7}                     # USB-C cutout in the back wall
# ------------------------------------------


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def rounded_box(name, w, d, h, r, z0):
    """Box with rounded vertical edges, bottom at z0."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z0 + h / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    if r > 0:
        bevel = obj.modifiers.new("round", "BEVEL")
        bevel.width = r
        bevel.segments = 16
        bevel.limit_method = "ANGLE"
        bevel.angle_limit = math.radians(60)
        bevel.affect = "EDGES"
        # Only round the vertical edges: mark them with a vertex group via edge selection
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.object.mode_set(mode="OBJECT")
        for e in obj.data.edges:
            v1, v2 = (obj.data.vertices[i].co for i in e.vertices)
            e.select = abs(v1.x - v2.x) < 1e-6 and abs(v1.y - v2.y) < 1e-6
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.mark_sharp()
        bpy.ops.object.mode_set(mode="OBJECT")
        weights = obj.data.attributes.get("bevel_weight_edge") or obj.data.attributes.new("bevel_weight_edge", "FLOAT", "EDGE")
        for i, e in enumerate(obj.data.edges):
            weights.data[i].value = 1.0 if e.select else 0.0
        bevel.limit_method = "WEIGHT"
        bpy.ops.object.modifier_apply(modifier="round")
    return obj


def cylinder(name, d, h, x, y, z0, verts=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=d / 2, depth=h, location=(x, y, z0 + h / 2))
    obj = bpy.context.active_object
    obj.name = name
    return obj


def boolean(target, cutter, op="DIFFERENCE"):
    mod = target.modifiers.new(cutter.name, "BOOLEAN")
    mod.operation = op
    mod.object = cutter
    mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def dome(name, r, x, y, z0):
    """Half sphere sitting flat on z0: the Spark hemisphere."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=r)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    cut = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
    rim = [e for e in cut["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    bmesh.ops.edgeloop_fill(bm, edges=rim)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = (x, y, z0)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True)
    return obj


def export_stl(objects, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.wm.stl_export(filepath=os.path.join(HERE, filename), export_selected_objects=True, ascii_format=False)


def build():
    clear_scene()
    top_z = BODY_H

    # ---- Shell: outer box minus inner box, open at the bottom ----
    shell = rounded_box("enclosure", BODY_W, BODY_D, BODY_H, CORNER_R, 0)
    inner = rounded_box("inner", BODY_W - 2 * WALL, BODY_D - 2 * WALL, BODY_H - TOP + 1, CORNER_R - WALL, -1)
    boolean(shell, inner)

    # ---- Raised ring around the joystick ----
    jx, jy = JOYSTICK["pos"]
    ring = cylinder("ring", JOYSTICK["ring_d"], JOYSTICK["ring_h"], jx, jy, top_z)
    boolean(shell, ring, "UNION")

    # ---- Holes through the top ----
    holes = [(JOYSTICK["hole_d"], jx, jy)]
    holes += [(KNOBS["shaft_d"], x, KNOBS["y"]) for x in KNOBS["xs"]]
    holes += [(IGNITE["hole_d"], *IGNITE["pos"])]
    holes += [(BUTTONS["hole_d"], x, y) for x, y in BUTTONS["pos"]]
    for i, (d, x, y) in enumerate(holes):
        boolean(shell, cylinder(f"hole{i}", d, TOP + JOYSTICK["ring_h"] + 4, x, y, top_z - TOP - 2))

    # ---- Screw posts in the corners ----
    bx = BODY_W / 2 - BOSS["inset"]
    by = BODY_D / 2 - BOSS["inset"]
    for i, (sx, sy) in enumerate([(-bx, -by), (bx, -by), (-bx, by), (bx, by)]):
        post = cylinder(f"post{i}", BOSS["d"], BODY_H - TOP, sx, sy, 0, 32)
        boolean(shell, post, "UNION")
        boolean(shell, cylinder(f"posthole{i}", BOSS["hole_d"], BODY_H - TOP - 4, sx, sy, -1, 24))

    # ---- USB-C cutout, back wall, centred ----
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, BODY_D / 2 - WALL / 2, 10))
    usb = bpy.context.active_object
    usb.name = "usb"
    usb.scale = (USB["w"], WALL * 4, USB["h"])
    bpy.ops.object.transform_apply(scale=True)
    boolean(shell, usb)

    # ---- Control caps (separate parts) ----
    knobs = []
    for i, x in enumerate(KNOBS["xs"]):
        k = cylinder(f"knob{i}", KNOBS["cap_d"], KNOBS["cap_h"], x, KNOBS["y"], top_z + 2)
        # grip notch on top so you can see which way it points
        notch = rounded_box("notch", 2.5, KNOBS["cap_d"] / 2, 3, 0, top_z + 2 + KNOBS["cap_h"] - 2)
        notch.location.x += x
        notch.location.y += KNOBS["y"] + KNOBS["cap_d"] / 4
        boolean(k, notch)
        # shaft socket underneath (D-shaft potentiometers are 6 mm)
        boolean(k, cylinder("socket", 6.2, 12, x, KNOBS["y"], top_z + 1))
        knobs.append(k)

    buttons = [cylinder(f"button{i}", BUTTONS["cap_d"], BUTTONS["cap_h"], x, y, top_z) for i, (x, y) in enumerate(BUTTONS["pos"])]

    ix, iy = IGNITE["pos"]
    ignite = dome("ignite", IGNITE["dome_r"], ix, iy, top_z)

    stick_base = dome("joystick_base", 14, jx, jy, top_z + JOYSTICK["ring_h"])
    stick = cylinder("joystick_shaft", 8, 26, jx, jy, top_z + JOYSTICK["ring_h"] + 6)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=11, location=(jx, jy, top_z + JOYSTICK["ring_h"] + 34))
    stick_ball = bpy.context.active_object
    stick_ball.name = "joystick_ball"

    return shell, knobs, buttons, ignite, [stick_base, stick, stick_ball]


def colour(obj, rgb):
    mat = bpy.data.materials.new(obj.name + "_mat")
    mat.diffuse_color = (*rgb, 1)
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def srgb(hex_code):
    c = [int(hex_code[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def render(path, cam_loc, cam_rot, ortho=None):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.render.film_transparent = True
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 750
    scene.render.image_settings.file_format = "WEBP"   # small files for slow connections
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 82
    scene.view_settings.view_transform = "Standard"
    cam_data = bpy.data.cameras.new("cam")
    if ortho:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho
    else:
        cam_data.lens = 50
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = [math.radians(a) for a in cam_rot]
    # aim at the middle of the controller
    target = bpy.data.objects.new("target", None)
    scene.collection.objects.link(target)
    target.location = (0, 0, BODY_H / 2)
    aim = cam.constraints.new("TRACK_TO")
    aim.target = target
    aim.track_axis = "TRACK_NEGATIVE_Z"
    aim.up_axis = "UP_Y"
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.objects.remove(target, do_unlink=True)


def export_part(obj, filename):
    """Export one part on its own, sitting on the build plate at the origin."""
    copy = obj.copy()
    copy.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(copy)
    bpy.ops.object.select_all(action="DESELECT")
    copy.select_set(True)
    bpy.context.view_layer.objects.active = copy
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    copy.location = (0, 0, copy.dimensions.z / 2)
    bpy.ops.object.transform_apply(location=True)
    export_stl([copy], filename)
    bpy.data.objects.remove(copy, do_unlink=True)


def main():
    shell, knobs, buttons, ignite, stick = build()

    export_stl([shell], "sparkplug-enclosure.stl")
    export_stl([shell, *knobs, *buttons, ignite, *stick], "sparkplug-assembly.stl")
    export_part(knobs[0], "sparkplug-knob.stl")
    export_part(ignite, "sparkplug-ignite.stl")

    colour(shell, srgb("#fff8ef"))
    for k in knobs:
        colour(k, srgb("#0077b6"))
    for b in buttons:
        colour(b, srgb("#03045e"))
    colour(ignite, srgb("#ff6d00"))
    for s in stick:
        colour(s, srgb("#023e8a"))

    os.makedirs(IMAGES, exist_ok=True)
    render(os.path.join(IMAGES, "sparkplug-3q.webp"), (260, -420, 330), (0, 0, 0), ortho=330)
    render(os.path.join(IMAGES, "sparkplug-top.webp"), (0, -0.01, 500), (0, 0, 0), ortho=300)


main()
