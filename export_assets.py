"""Run in Blender: export original 3D scenes and animated travelers for the game."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
OUT = HERE / 'assets'
RAW = OUT / 'raw'
RAW.mkdir(parents=True, exist_ok=True)


def setup(w, h, transparent=False):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE_NEXT'
    s.eevee.taa_render_samples = 32
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    s.render.film_transparent = transparent
    s.render.use_persistent_data = True
    return s


for kind, filename in [('grassland', 'grassland_stroll.blend'), ('forest', 'forest_stroll_v2.blend'), ('alpine', 'alpine_stroll.blend')]:
    bpy.ops.wm.open_mainfile(filepath=str(BASE / filename))
    scene = setup(1920, 1080)
    scene.frame_set(200)
    for rootname in ['Traveler', 'Companion']:
        root = bpy.data.objects[rootname]
        for ob in [root, *root.children_recursive]:
            ob.hide_render = True
    for coll in bpy.data.collections:
        if kind == 'grassland' and coll.name.startswith(('Grassland | rolling', 'Grassland | wind', 'Grassland | wildflower')):
            for ob in coll.objects:
                if not ob.name.startswith('Long rolling horizon'):
                    ob.hide_render = True
        elif kind == 'alpine' and coll.name.startswith('Alpine | traversable'):
            coll.hide_render = True
        elif kind == 'forest' and coll.name.startswith(('04 |', '06 |', '12 |')):
            coll.hide_render = True
    scene.render.filepath = str(RAW / ('bg-' + kind + '.png'))
    bpy.ops.render.render(write_still=True)

source = BASE / 'forest_stroll_v3.blend'
if not source.exists():
    source = BASE / 'forest_stroll_v2.blend'
for name, short in [('Traveler', 'hero'), ('Companion', 'cat')]:
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = setup(256, 256, True)
    scene.use_nodes = False
    root = bpy.data.objects[name]
    keep = {root, *root.children_recursive}
    for ob in bpy.data.objects:
        ob.hide_render = ob not in keep
    scene.world.use_nodes = True
    nodes = scene.world.node_tree.nodes
    nodes.get('Background').inputs[0].default_value = (.5, .6, .68, 1)
    nodes.get('Background').inputs[1].default_value = .65
    for title, pos, energy, size in [('Key', (-3, -4, 6), 500, 6), ('Fill', (4, -1, 4), 280, 5)]:
        d = bpy.data.lights.new(title, 'AREA'); d.energy = energy; d.size = size
        o = bpy.data.objects.new(title, d); scene.collection.objects.link(o)
        o.location = pos
        o.rotation_euler = (Vector((-5, 0, 2)) - o.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.cameras.new('Sprite camera'); data.type = 'ORTHO'
    data.ortho_scale = 1.98 if short == 'hero' else 1.12
    camera = bpy.data.objects.new('Sprite camera', data); scene.collection.objects.link(camera)
    scene.camera = camera
    for index, frame in enumerate(range(1, 25, 2)):
        scene.frame_set(frame)
        target = root.matrix_world.translation + Vector((0, 0, .80 if short == 'hero' else .30))
        camera.location = target + Vector((.35, -8, .2))
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(RAW / f'{short}-{index:02d}.png')
        bpy.ops.render.render(write_still=True)
print('GAME_ASSETS_EXPORTED', flush=True)
