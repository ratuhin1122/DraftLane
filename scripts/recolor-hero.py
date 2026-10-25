"""Create a selective orange-to-mint LUT for the DraftLane walkthrough."""
import colorsys
from pathlib import Path
size=33
lines=['TITLE "DraftLane mint accents"',f'LUT_3D_SIZE {size}','DOMAIN_MIN 0 0 0','DOMAIN_MAX 1 1 1']
for b in range(size):
 for g in range(size):
  for r in range(size):
   rgb=(r/(size-1),g/(size-1),b/(size-1))
   h,s,v=colorsys.rgb_to_hsv(*rgb)
   # Target warm orange UI accents; preserve neutral panels and other diagram colors.
   weight=max(0,min(1,(h-0.005)/0.025,(0.19-h)/0.05,(s-0.15)/0.25))
   mint=colorsys.hsv_to_rgb(0.452,s*0.65,v)
   out=[a+(z-a)*weight for a,z in zip(rgb,mint)]
   lines.append(' '.join(f'{c:.6f}' for c in out))
Path('scripts/draftlane-mint.cube').write_text('\n'.join(lines)+'\n',encoding='ascii')
