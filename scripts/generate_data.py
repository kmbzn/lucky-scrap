import json
from pathlib import Path
names='무(無),나뭇가지,나뭇잎,나무껍질,볏짚,목화,덩굴,동물 가죽,깃털,돌멩이,모래,점토,조개껍데기,석탄,철광석,구리광석,은,금,진주,토파즈,루비,사파이어,에메랄드,다이아몬드,실,천,밧줄,종이,종이 상자,가죽끈,나무판자,나무 액자,유리,벽돌,철괴,구리괴,나무 상자,은괴,금괴,밀짚모자,가죽 장갑,조개 목걸이,종이비행기,깃펜,편지,유리병,거울,돋보기,가위,열쇠,자물쇠,낚싯대,부채,우산,가죽 가방,팔찌,진주 목걸이,토파즈 반지,루비 반지,사파이어 귀걸이,에메랄드 목걸이,다이아몬드 왕관,명예의 훈장,우승 트로피'.split(',')
w=[0,100,90,80,90,80,70,50,60,70,60,50,50,30,30,25,18,12,11,9,5,4,4,2]+[0]*40
r=[{5:2},{24:2},{6:2},{3:2,2:1},{27:3},{7:1},{1:3},{30:2,29:1},{10:2,13:1},{11:2,9:1,13:1},{14:2,13:1},{15:2,13:1},{30:3,26:1},{16:2,13:1},{17:2,13:1},{4:3,24:1},{7:2,24:1},{12:2,24:1},{27:1},{8:1,1:1},{27:1,43:1},{32:2,13:1},{32:1,37:1},{32:1,35:1},{34:2,35:1},{35:1},{34:1,49:1},{1:1,24:1,34:1},{27:2,1:1},{25:2,1:2,34:1},{7:2,29:1,24:1},{35:1,21:1},{18:2,24:1},{38:1,19:1},{38:1,20:1},{37:1,21:2},{38:1,22:2,24:1},{38:2,23:2,37:1},{38:30,57:1,58:1,59:1,25:40,37:8,34:8},{62:1,38:8,61:1,60:1,30:24,32:16}]
data=[dict(id=i,name=n,kind='secret' if i==0 else 'natural' if i<24 else 'crafted',weight=w[i],recipe={} if i<24 else r[i-24]) for i,n in enumerate(names)]
Path('lib/items.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
sql='\ninsert into public.items(id,name,kind,weight) values\n'+',\n'.join(f"({i},'{n}','{data[i]['kind']}',{w[i]})" for i,n in enumerate(names))+';\n'
sql+='insert into public.recipes(result_id) values '+','.join(f'({i})' for i in range(24,64))+';\n'
sql+='insert into public.recipe_inputs(result_id,item_id,quantity) values '+','.join(f'({i},{k},{v})' for i in range(24,64) for k,v in r[i-24].items())+';\n'
sql=sql.replace(';',' on conflict do nothing;')
Path('supabase/seed.sql').write_text(sql)
Path('supabase/migrations/202610170002_catalog.sql').write_text(sql)
