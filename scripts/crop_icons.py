from PIL import Image
from pathlib import Path
import shutil
root=Path(__file__).resolve().parent.parent
source=root/'items.png'
if source.exists(): shutil.copyfile(source,root/'public/items.png')
im=Image.open(root/'public/items.png')
assert im.size==(1254,1254) and im.mode=='RGBA'
edges=[0,157,314,470,627,784,940,1097,1254]
for i in range(64):
 x,y=i%8,i//8
 im.crop((edges[x],edges[y],edges[x+1],edges[y+1])).save(root/f'public/item-icons/{i:03}.png')
assert Image.open(root/'public/item-icons/000.png').getchannel('A').getextrema()==(0,0)
print('64 icons cropped; original RGBA pixels preserved.')
