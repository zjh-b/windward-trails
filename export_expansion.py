"""Blender 4.5: build original expansion landscapes and clothed traveler variants.

No source .blend is saved or overwritten. Run with -- background_name to render
only one section (lagoon, desert, cavern, ranger, mage).
"""
import math
from pathlib import Path
import random
import sys
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
RAW = HERE / 'assets' / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
ONLY = set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
random.seed(4102)


def material(name, color, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .82
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = emission
    return m


def finish(ob, name, mat, parent=None):
    ob.name = name
    ob.data.materials.append(mat)
    if parent:
        ob.parent = parent
    return ob


def ico(name, loc, scale, mat, sub=2, parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1)
    ob = finish(bpy.context.object, name, mat, parent)
    ob.location, ob.scale = loc, scale
    return ob


def cone(name, loc, r1, r2, depth, mat, parent=None, vertices=10):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth)
    ob = finish(bpy.context.object, name, mat, parent)
    ob.location = loc
    return ob


def mesh(name, vertices, faces, mat, parent=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    return finish(ob, name, mat, parent)


def rod(name, a, b, radius, mat, parent=None):
    a, b = Vector(a), Vector(b)
    ob = cone(name, (a+b)/2, radius, radius*.8, (b-a).length, mat, parent)
    ob.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return ob


def setup(w=1920, h=1080, transparent=False):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE_NEXT'
    s.eevee.taa_render_samples = 24
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'
    s.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    s.render.film_transparent = transparent
    s.view_settings.view_transform = 'AgX'
    s.render.use_persistent_data = True
    s.use_nodes = False
    return s


def camera(pos, target, scale):
    data = bpy.data.cameras.new('Expansion camera')
    data.type = 'ORTHO'; data.ortho_scale = scale
    ob = bpy.data.objects.new('Expansion camera', data)
    bpy.context.collection.objects.link(ob)
    ob.location = pos
    ob.rotation_euler = (Vector(target)-ob.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = ob
    return ob


def light(name, pos, energy, color=(1, 1, 1), size=12, kind='AREA'):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy; data.color = color
    if kind == 'AREA': data.shape = 'DISK'; data.size = size
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.location = pos
    ob.rotation_euler = (Vector((0, 3, 1))-ob.location).to_track_quat('-Z', 'Y').to_euler()
    return ob


def scene_base(color, strength=.65):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = setup()
    world = bpy.data.worlds.new('Expansion atmosphere')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (*color, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = strength
    s.world = world
    cam = camera((0, -38, 12), (0, 12, 5), 45)
    cam.data.type = 'PERSP'
    cam.data.lens = 36
    return s


def plane(name, loc, scale, mat):
    bpy.ops.mesh.primitive_plane_add(size=2, location=loc)
    ob = finish(bpy.context.object, name, mat)
    ob.scale = scale
    return ob


def clouds(mat):
    for x, y, z, w in [(-14, 35, 13, 4), (4, 43, 15, 5), (20, 35, 11, 3)]:
        for j in range(3):
            ico('Soft cloud', (x+j*w*.5, y, z+math.sin(j)*.4), (w, 1.4, .8+j%2*.4), mat, 3)


def palm(x, y, z, scale, trunk, leaf):
    top = (x+.5*scale, y, z+4.8*scale)
    mid = (x+.3*scale, y, z+2.6*scale)
    rod('Curved palm trunk', (x,y,z), mid, .15*scale, trunk)
    rod('Curved palm trunk', mid, top, .12*scale, trunk)
    for i in range(7):
        a=i*math.tau/7
        direction=Vector((math.cos(a),math.sin(a),0))
        side=Vector((-math.sin(a),math.cos(a),0))
        p=Vector(top)
        ridge=p+direction*1.15*scale+Vector((0,0,.65*scale))
        tip=p+direction*2.6*scale-Vector((0,0,.6*scale))
        vertices=[p, ridge-side*.42*scale,ridge+Vector((0,0,.12*scale)),ridge+side*.42*scale,tip]
        mesh('Palm frond',vertices,[(0,1,2),(0,2,3),(1,4,2),(2,4,3)],leaf)


def lagoon():
    s=scene_base((.36,.68,.76))
    sea=material('Lagoon water',(.065,.46,.48),.10)
    sand=material('Island limestone',(.65,.66,.46))
    grass=material('Island moss',(.17,.33,.16))
    trunk=material('Palm bark',(.27,.19,.10))
    leaf=material('Palm leaves',(.19,.40,.20))
    far=material('Distant blue islands',(.24,.47,.48),.1)
    cloud=material('Sea clouds',(.83,.88,.77),.15)
    plane('Sea',(0,30,-.35),(90,110,1),sea)
    for x,y,r,h in [(-18,28,7,5),(2,37,6,4),(19,30,6,7),(-12,5,5,3),(12,10,6,4)]:
        m=far if y>20 else sand
        ico('Rocky island',(x,y,h*.28),(r,r*.7,h),m)
        if y<20:
            ico('Island canopy',(x,y,h*.75),(r*.85,r*.6,.7),grass)
            palm(x-1,y,h*.9,1,trunk,leaf)
            palm(x+2,y+1,h*.8,.68,trunk,leaf)
    foam=material('Quiet foam',(.55,.79,.69),.2)
    for k in range(26):
        x=random.uniform(-31,31);y=random.uniform(-2,32)
        ico('Sea glimmer',(x,y,-.28),(random.uniform(.5,2.2),.09,.025),foam,1)
    clouds(cloud)
    light('Afternoon sun',(-12,-12,26),2.4,(1,.91,.71),kind='SUN')
    s.render.filepath=str(RAW/'bg-lagoon.png');bpy.ops.render.render(write_still=True)


def dune(name, cx, cy, width, depth, height, mat):
    verts=[];faces=[];nx=40;ny=20
    for j in range(ny+1):
        y=(j/ny-.5)*depth
        for i in range(nx+1):
            x=(i/nx-.5)*width
            fade=math.sin(math.pi*i/nx)*math.sin(math.pi*j/ny)
            ridge=height*math.exp(-((x/width*1.8)**2+(y/depth*1.4)**2))
            z=-1+fade*(ridge+1+.35*math.sin(x*.18+y*.15))
            verts.append((cx+x,cy+y,z))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
    return mesh(name,verts,faces,mat)


def desert():
    s=scene_base((.66,.36,.24),.72)
    ochre=material('Dune warm ochre',(.67,.35,.15))
    gold=material('Dune sunlit gold',(.79,.49,.23))
    peach=material('Dune distant peach',(.60,.38,.28))
    stone=material('Weathered sandstone',(.49,.25,.12))
    sage=material('Desert sage',(.20,.32,.21))
    plane('Sand plain',(0,35,-1),(110,120,1),ochre)
    dune('Distant dune',-18,35,100,25,6,peach)
    dune('Windward dune',9,20,90,20,4.5,gold)
    dune('Near dune',-20,-2,75,18,2.6,ochre)
    # A monumental weathered arch, open in the middle, built from tapered blocks.
    for i in range(10):
        a=math.pi*i/9
        x=9+4.2*math.cos(a);z=4.4+5.0*math.sin(a)
        ob=ico('Arch sandstone block',(x,16,z),(1.65,2.1,1.6),stone,1)
        ob.rotation_euler[1]=a
    for x in [4.8,13.2]:
        ico('Arch footing',(x,16,2.5),(1.6,2.2,3.3),stone,1)
    for x,y,z,sc in [(-13,8,2.5,1),(-10,9,2.3,.7),(18,4,1.3,.75)]:
        rod('Cactus stem',(x,y,z),(x,y,z+3*sc),.22*sc,sage)
        for side in [-1,1]:
            px=x+side*.7*sc
            rod('Cactus branch',(x,y,z+1.3*sc),(px,y,z+1.5*sc),.15*sc,sage)
            rod('Cactus branch tip',(px,y,z+1.5*sc),(px,y,z+2.4*sc),.15*sc,sage)
    sun=material('Setting sun', (1,.66,.25),2)
    ico('Sun disk',(-12,38,15),(2.2,.2,2.2),sun,4)
    light('Warm evening sun',(-22,-10,16),2.5,(1,.65,.31),kind='SUN')
    s.render.filepath=str(RAW/'bg-desert.png');bpy.ops.render.render(write_still=True)


def crystal(name, loc, size, mat, tilt=0):
    radius,height=size
    count=6;verts=[]
    for z,r in [(0,radius*.8),(height*.72,radius),(height,0)]:
        for i in range(count):
            a=i*math.tau/count;verts.append((r*math.cos(a),r*math.sin(a),z))
    faces=[]
    for row in range(2):
        for i in range(count):
            a=row*count+i;b=row*count+(i+1)%count;faces.append((a,b,b+count,a+count))
    ob=mesh(name,verts,faces,mat);ob.location=loc;ob.rotation_euler[1]=tilt
    return ob


def cavern():
    s=scene_base((.022,.045,.072),.4)
    rock=material('Cave indigo',(.045,.075,.13))
    far=material('Far cave teal',(.06,.16,.19),.1)
    floor=material('Cavern floor',(.045,.12,.13))
    turquoise=material('Turquoise crystal',(.08,.58,.62),1.2)
    pale=material('Mint crystal',(.32,.78,.62),.8)
    violet=material('Violet crystal',(.28,.19,.55),.65)
    plane('Cave floor',(0,20,-.6),(90,100,1),floor)
    for x,y,h,r in [(-25,23,19,8),(-12,32,15,7),(6,36,20,8),(24,25,18,9)]:
        ico('Far cave pillar',(x,y,h*.45),(r,6,h*.6),far,2)
    for x in [-24,-21,22,26]:
        ico('Cavern frame',(x,5,8),(5,6,15),rock,2)
    for i in range(9):
        x=-24+i*6
        cone('Ceiling stalactite',(x,16,16-random.random()*2),0,random.uniform(1.5,3),random.uniform(4,8),rock)
    for x,y,z in [(-17,11,0),(-11,20,.5),(14,8,0),(20,24,.4),(2,30,.2)]:
        for j in range(4):
            crystal('Glowing crystal',(x+(j-1.5)*.9,y+j*.5,z),(.55+random.random()*.3,2.5+random.random()*4),[turquoise,pale,violet][j%3],(j-1.5)*.18)
    for i in range(30):
        ico('Cave glow motes',(random.uniform(-25,25),random.uniform(5,30),random.uniform(1,13)),(.035,.035,.035),pale,1)
    light('Cave turquoise fill',(-9,-4,11),2200,(.2,.85,1),15)
    light('Cave lavender fill',(15,5,10),1600,(.55,.38,1),12)
    # Restrained glow retains the faceted crystal silhouette.
    s.use_nodes=True;nodes=s.node_tree.nodes;nodes.clear()
    layers=nodes.new('CompositorNodeRLayers');glow=nodes.new('CompositorNodeGlare')
    glow.glare_type='FOG_GLOW';glow.threshold=1.1;glow.quality='HIGH';glow.mix=-.8
    output=nodes.new('CompositorNodeComposite');s.node_tree.links.new(layers.outputs['Image'],glow.inputs['Image']);s.node_tree.links.new(glow.outputs['Image'],output.inputs['Image'])
    s.render.filepath=str(RAW/'bg-cavern.png');bpy.ops.render.render(write_still=True)


def character(kind):
    source=BASE/'forest_stroll_v3.blend'
    if not source.exists():source=BASE/'forest_stroll_v2.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source))
    s=setup(256,256,True)
    root=bpy.data.objects['Traveler'];body=bpy.data.objects[root['body']]
    keep={root,*root.children_recursive}
    for ob in bpy.data.objects:ob.hide_render=ob not in keep
    cloth=(.055,.20,.10) if kind=='ranger' else (.035,.09,.28)
    trim=(.51,.44,.18) if kind=='ranger' else (.72,.50,.18)
    for name,color in [('Traveler.ochre_red',cloth),('Traveler.cloak_edge',trim),('Traveler.scarf',trim)]:
        m=bpy.data.materials.get(name)
        if m:
            m.diffuse_color=(*color,1)
            p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Emission Color'].default_value=(*color,1)
    hat=material(kind+' hat',cloth)
    ribbon=material(kind+' gold trim',trim)
    if kind=='ranger':
        cone('Ranger broad brim',(-.02,0,1.31),.34,.33,.035,hat,body,vertices=32)
        cone('Ranger crown',(-.035,0,1.41),.175,.12,.2,hat,body,vertices=24)
        cone('Ranger hat band',(-.035,0,1.34),.18,.175,.048,ribbon,body,vertices=24)
        feather=mesh('Ranger feather',[(-.13,-.13,1.37),(-.23,-.12,1.68),(-.08,-.12,1.55),(-.1,-.13,1.38)],[(0,1,2,3)],ribbon,body)
        pack=material('Ranger pack',(.22,.26,.12))
        ico('Ranger backpack',(-.25,.025,.82),(.12,.17,.22),pack,2,body)
        rod('Rolled blanket',(-.29,-.19,1.03),(-.29,.19,1.03),.085,ribbon,body)
    else:
        cone('Mage wide brim',(-.02,0,1.30),.32,.30,.045,hat,body,vertices=32)
        # Slanted, faceted cap creates a different silhouette from the ranger.
        n=20;v=[]
        for z,r,dx in [(1.31,.19,0),(1.52,.12,-.035),(1.73,.035,-.12),(1.77,.005,-.20)]:
            for i in range(n):
                a=i*math.tau/n;v.append((dx+r*math.cos(a),r*math.sin(a),z))
        faces=[(row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i) for row in range(3) for i in range(n)]
        mesh('Mage pointed cap',v,faces,hat,body)
        cone('Mage hat ribbon',(0,0,1.34),.188,.175,.055,ribbon,body,vertices=24)
        star=[]
        for i in range(10):
            a=math.pi/2+i*math.pi/5;r=.045 if i%2==0 else .02
            star.append((.01+math.cos(a)*r,-.194,1.36+math.sin(a)*r))
        mesh('Mage star badge',star,[tuple(range(10))],ribbon,body)
        orb=material('Mage satchel stone',(.15,.64,.72),.5)
        ico('Mage charm',(.02,-.32,.68),(.025,.016,.035),orb,2,body)
    s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.6,.68,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    key=light('Sprite key',(-3,-4,6),500,size=6)
    fill=light('Sprite fill',(4,-1,4),280,size=5)
    cam=camera((0,-8,1), (0,0,1),2.25 if kind=='ranger' else 2.52)
    for index,frame in enumerate(range(1,25,2)):
        s.frame_set(frame)
        target=root.matrix_world @ Vector((0,0,.84 if kind=='ranger' else .90))
        cam.location=target+Vector((.35,-8,.2));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        for ob,offset in [(key,(-3,-4,6)),(fill,(4,-1,4))]:
            ob.location=root.matrix_world.translation+Vector(offset)
            ob.rotation_euler=(target-ob.location).to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(RAW/f'{kind}-{index:02d}.png');bpy.ops.render.render(write_still=True)


for name,fn in [('lagoon',lagoon),('desert',desert),('cavern',cavern)]:
    if not ONLY or name in ONLY:
        fn();print('EXPANSION_RENDERED',name,flush=True)
for name in ['ranger','mage']:
    if not ONLY or name in ONLY:
        character(name);print('EXPANSION_RENDERED',name,flush=True)
