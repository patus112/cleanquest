"""Create original, self-contained PNG app icons without external assets."""
import math, struct, zlib
from pathlib import Path

def write_icon(size, name):
    rows=[]
    for y in range(size):
        row=bytearray()
        for x in range(size):
            # Rotated leaf and a clean vein, entirely inside maskable safe zone.
            dx=(x+.5)/size-.5; dy=(y+.5)/size-.5
            u=(dx-dy)/math.sqrt(2); v=(dx+dy)/math.sqrt(2)
            leaf=(u/.25)**2+(v/.135)**2<1
            vein=abs(v)<.009 and -.27<u<.18
            stem=abs(v)<.014 and -.30<u<-.12
            color=(165,214,178) if leaf or stem else (16,18,22)
            if leaf and vein: color=(37,65,45)
            row.extend((*color,255))
        rows.append(b'\0'+row)
    def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
    Path('public',name).write_bytes(data)
for size,name in [(192,'icon-192.png'),(512,'icon-512.png'),(512,'icon-maskable.png'),(180,'apple-touch-icon.png')]:write_icon(size,name)
