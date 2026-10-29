import bpy,bmesh
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/mascot/vector-intelligence-mascot-rig.blend'))
for name in ['GlassDome','FaceShell']:
 o=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(o.data)
 # The two shells share their boundary: apply identical relaxation to both.
 boundary=[v for v in bm.verts if v.is_boundary and v.co.z>.15]
 for _ in range(18):
  coords={v:sum((e.other_vert(v).co for e in v.link_edges if e.is_boundary),v.co.copy()*0)/2 for v in boundary}
  for v,co in coords.items():v.co=v.co.lerp(co,.5)
 bm.to_mesh(o.data);bm.free()
 if name=='GlassDome':
  mod=o.modifiers.new('Polished surface','SMOOTH');mod.factor=.7;mod.iterations=14
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Narrow polished trim follows the exact junction.
 if name=='FaceShell':
  bm=bmesh.new();bm.from_mesh(o.data)
  edges=[e for e in bm.edges if e.is_boundary and all(v.co.z>.15 for v in e.verts)]
  cu=bpy.data.curves.new('Dome seal','CURVE');cu.dimensions='3D';cu.bevel_depth=.007;cu.bevel_resolution=3
  for e in edges:
   sp=cu.splines.new('POLY');sp.points.add(1)
   for p,v in zip(sp.points,e.verts):p.co=(*v.co,1)
  trim=bpy.data.objects.new('DomeSeal',cu);bpy.context.collection.objects.link(trim);trim.parent=o.parent;trim.location=o.location
  mat=bpy.data.materials.new('Graphite seal');mat.diffuse_color=(.015,.025,.045,1);cu.materials.append(mat);bm.free()
o=bpy.data.objects['FaceShell'];bm=bmesh.new();bm.from_mesh(o.data)
for side in [-1,1]:
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0001,plane_co=(side*.735,0,0),plane_no=(side,0,0),clear_outer=True)
bm.to_mesh(o.data);bm.free()
o=bpy.data.objects['FaceShell'];bm=bmesh.new();bm.from_mesh(o.data)
remove=[f for f in bm.faces if f.calc_center_median().z<-.48 and abs(f.calc_center_median().x)>.31]
bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(o.data);bm.free()
o=bpy.data.objects['RobotVolumeBody'];bm=bmesh.new();bm.from_mesh(o.data)
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
bm.to_mesh(o.data);bm.free()
for o in list(bpy.data.objects):
 if o.name.startswith(('BrainBranch','BrainCore','BrainNode')) or o.name=='SourceFaceDetailBody':bpy.data.objects.remove(o,do_unlink=True)
o=bpy.data.objects['SourceFaceDetailHead'];bm=bmesh.new();bm.from_mesh(o.data)
faces=[f for f in bm.faces if f.calc_center_median().z>.255+.24*(abs(f.calc_center_median().x)/.97)**2 or f.calc_center_median().z<-.48]
bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(o.data);bm.free()
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/assets/models/vector-intelligence-mascot-preview.glb'),export_format='GLB',export_cameras=False,export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/mascot/vector-intelligence-mascot-refined.blend'))
