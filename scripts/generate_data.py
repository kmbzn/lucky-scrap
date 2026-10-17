import json
from pathlib import Path
names='무(無),나뭇가지,나뭇잎,나무껍질,볏짚,목화,덩굴,동물 가죽,깃털,돌멩이,모래,점토,조개껍데기,석탄,철광석,구리광석,은,금,진주,토파즈,루비,사파이어,에메랄드,다이아몬드,실,천,밧줄,종이,종이 상자,가죽끈,나무판자,나무 액자,유리,벽돌,철괴,구리괴,나무 상자,은괴,금괴,밀짚모자,가죽 장갑,조개 목걸이,종이비행기,깃펜,편지,유리병,거울,돋보기,가위,열쇠,자물쇠,낚싯대,부채,우산,가죽 가방,팔찌,진주 목걸이,토파즈 반지,루비 반지,사파이어 귀걸이,에메랄드 목걸이,다이아몬드 왕관,명예의 훈장,우승 트로피'.split(',')
w=[0, 80, 90, 90, 104, 81, 70, 50, 60, 70, 50, 50, 50, 40, 30, 30, 20, 10, 10, 5, 4, 3, 2, 1]+[0]*40
r=[{5: 2}, {24: 2}, {6: 2}, {3: 2, 2: 2}, {27: 2}, {7: 1}, {1: 2}, {30: 2, 29: 2}, {10: 2, 13: 2}, {11: 2, 9: 2, 13: 2}, {14: 2, 13: 2}, {15: 2, 13: 2}, {30: 2, 26: 2}, {16: 2}, {17: 2}, {4: 2, 24: 2}, {7: 2, 24: 2}, {12: 2, 24: 2}, {27: 2}, {8: 1, 1: 1}, {27: 2, 43: 2}, {32: 2, 13: 2}, {32: 2, 37: 2}, {32: 2, 35: 2}, {34: 2, 35: 2}, {35: 2}, {34: 2, 49: 2}, {1: 2, 24: 2, 34: 2}, {27: 2, 1: 2}, {25: 2, 1: 2, 34: 2}, {7: 2, 29: 2, 24: 2}, {35: 1, 21: 1}, {18: 1, 38: 2}, {38: 1, 19: 1}, {38: 1, 20: 1}, {21: 2, 38: 1}, {22: 1, 38: 2}, {38: 2, 23: 1, 37: 1}, {38: 5, 57: 1, 58: 1, 59: 1, 25: 5, 37: 2, 34: 2}, {62: 1, 38: 3, 61: 1, 30: 5, 32: 3, 56: 1}]
data=[dict(id=i,name=n,kind='secret' if i==0 else 'natural' if i<24 else 'crafted',weight=w[i],recipe={} if i<24 else r[i-24]) for i,n in enumerate(names)]
Path('lib/items.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
sql='\ninsert into public.items(id,name,kind,weight) values\n'+',\n'.join(f"({i},'{n}','{data[i]['kind']}',{w[i]})" for i,n in enumerate(names))+';\n'
sql+='insert into public.recipes(result_id) values '+','.join(f'({i})' for i in range(24,64))+';\n'
sql+='delete from public.recipe_inputs where result_id between 24 and 63;\n'
sql+='insert into public.recipe_inputs(result_id,item_id,quantity) values '+','.join(f'({i},{k},{v})' for i in range(24,64) for k,v in r[i-24].items())+';\n'
sql=sql.replace(';',' on conflict do nothing;').replace('where result_id between 24 and 63 on conflict do nothing;', 'where result_id between 24 and 63;')
sql=sql.replace(' on conflict do nothing;', ' on conflict (id) do update set weight=excluded.weight;', 1)
sql=sql.rsplit(' on conflict do nothing;', 1)[0] + ' on conflict (result_id,item_id) do update set quantity=excluded.quantity;\n'
Path('supabase/seed.sql').write_text('begin;\n'+sql+'commit;\n')
# Historical migrations stay immutable; use a new migration for recipe changes.
