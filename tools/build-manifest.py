import re,json,os,html
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out=[]
for folder,kind in (("Articles","articles"),("Tutorials","tutorials"),("Materials","materials")):
    for fn in sorted(os.listdir(os.path.join(root,folder))):
        if not fn.endswith(".html"): continue
        s=open(os.path.join(root,folder,fn),encoding="utf-8").read()
        t=None
        m=re.search(r'<h2 class="article-title">(.*?)</h2>',s,re.S) if kind=="articles" else None
        if not m: m=re.search(r'<div class="text-content">.*?<h2>(.*?)</h2>',s,re.S)
        t=html.unescape(re.sub(r'<.*?>','',m.group(1))).strip() if m else None
        m=re.search(r'<div class="text-content">\s*<h4>(.*?)</h4>',s,re.S)
        cat=html.unescape(m.group(1)).strip() if m else ""
        m=re.search(r'class="material-meta">(.*?)</p>',s,re.S)
        meta=html.unescape(m.group(1)).strip() if m else ""
        out.append(dict(slug=fn[:-5],kind=kind,title=t,category=cat,meta=meta))
json.dump(out,open(os.path.join(root,"tools","covers-manifest.json"),"w",encoding="utf-8"),indent=1,ensure_ascii=False)
for o in out: print(o["kind"][:3],o["slug"],"|",o["title"],"|",o["category"],"|",o["meta"])
