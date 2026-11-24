#!/usr/bin/env python3
"""Genera PDF, HTML y ZIP de referencia sin modificar la aplicación ni sus datos.
Requiere Python, Pycairo, PyGObject/Pango y Pygments en el entorno de edición.
Estas dependencias son solo para maquetar el libro; la aplicación sigue usando Node.
"""
from pathlib import Path
import hashlib, html, importlib.util, json, math, re, textwrap, zipfile
import cairo, gi
gi.require_version('Pango', '1.0')
gi.require_version('PangoCairo', '1.0')
from gi.repository import Pango, PangoCairo
from pygments import highlight, lex
from pygments.lexers import get_lexer_by_name, TextLexer
from pygments.formatters import HtmlFormatter
from pygments.token import Token

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
BASE='SG-CICT_Manual_completo_de_construccion'
W,H=595.276,841.89
M=47.0
CW=W-2*M
TOP,BOTTOM=57.0,H-52
C={'ink':'233f37','muted':'65766c','forest':'173f3a','green':'4c785a','lime':'d4edbd','line':'dde6dd','paper':'f3f7f1','white':'ffffff','purple':'69518b','blue':'326c88'}

def rgb(value):
    value=C.get(value,value).lstrip('#')
    return tuple(int(value[i:i+2],16)/255 for i in (0,2,4))
def lexer_for(name):
    name={'ts':'typescript','md':'markdown','svg':'xml','gitignore':'text','powershell':'powershell','json':'json'}.get(name,name)
    try:return get_lexer_by_name(name)
    except Exception:return TextLexer()

def inventory():
    files=[]
    for folder in ['src','public','tests','scripts','docs']:
        files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file())
    files.extend(ROOT/p for p in ['package.json','README.md','.gitignore','data/.gitkeep'])
    return sorted(set(files),key=lambda p:str(p.relative_to(ROOT)))
FILES=inventory()
TEXTS={str(p.relative_to(ROOT)):p.read_text() for p in FILES if p.suffix!='.png'}
HASHES={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in FILES}

spec=importlib.util.spec_from_file_location('contenido_manual',HERE/'contenido_manual.py')
content=importlib.util.module_from_spec(spec);spec.loader.exec_module(content)
BLOCKS=list(content.BLOCKS)
CHAPTERS=[b for b in BLOCKS if b['kind']=='chapter']
for i,b in enumerate(CHAPTERS,1):b['number']=str(i);b['anchor']='c'+str(i)
APPENDIX=[]
for i,(name,text) in enumerate(TEXTS.items(),1):
    APPENDIX.append({'kind':'chapter','title':name,'subtitle':'Código íntegro de referencia · guarda este contenido en la ruta indicada.','number':'A.'+str(i),'anchor':'file-'+str(i),'appendix':True})
    APPENDIX.append({'kind':'paragraph','text':'SHA-256 del archivo: '+HASHES[name]+'. Los números del margen y las marcas de continuación son ayudas de lectura y no forman parte del archivo. El contenido exacto también está en el HTML y en el ZIP de referencia.'})
    APPENDIX.append({'kind':'code','text':text.rstrip('\n'),'label':name,'language':Path(name).suffix.lstrip('.') or 'text','start':1,'full_source':name})
ENTRIES=CHAPTERS+[b for b in APPENDIX if b['kind']=='chapter']

class Book:
    def __init__(self,path,total=0,known=None):
        self.surface=cairo.PDFSurface(str(path),W,H)
        self.surface.set_metadata(cairo.PDFMetadata.TITLE,'SG-CICT · Manual completo de construcción')
        self.surface.set_metadata(cairo.PDFMetadata.AUTHOR,'Manual educativo basado en el prototipo SG-CICT')
        self.surface.set_metadata(cairo.PDFMetadata.SUBJECT,'TypeScript, HTML, CSS, SQLite: explicación archivo por archivo y código íntegro')
        self.surface.set_metadata(cairo.PDFMetadata.KEYWORDS,'SG-CICT TypeScript HTML CSS SQLite aprendizaje código referencia')
        self.ctx=cairo.Context(self.surface)
        self.page=0;self.y=TOP;self.title='';self.total=total;self.known=known or {};self.positions={};self.bounds=[];self.code_checks=[];self.outline_parent=0
    def fill(self,color):self.ctx.set_source_rgb(*rgb(color))
    def rect(self,x,y,w,h,color):self.fill(color);self.ctx.rectangle(x,y,w,h);self.ctx.fill()
    def layout(self,text,width=CW,size=10.2,bold=False,color='ink',mono=False,markup=False,spacing=2.5):
        l=PangoCairo.create_layout(self.ctx)
        PangoCairo.context_set_resolution(l.get_context(),72)
        f=Pango.FontDescription();f.set_family('DejaVu Sans Mono' if mono else 'DejaVu Sans');f.set_absolute_size(size*Pango.SCALE)
        f.set_weight(Pango.Weight.BOLD if bold else Pango.Weight.NORMAL)
        l.set_font_description(f);l.set_width(int(width*Pango.SCALE));l.set_wrap(Pango.WrapMode.WORD_CHAR)
        l.set_spacing(int(spacing*Pango.SCALE))
        if markup:l.set_markup(text,-1)
        else:l.set_text(text,-1)
        return l,l.get_size()[1]/Pango.SCALE
    def text(self,text,x,y,width=CW,size=10.2,bold=False,color='ink',mono=False,markup=False,spacing=2.5,center=False):
        l,height=self.layout(text,width,size,bold,color,mono,markup,spacing)
        if center:l.set_alignment(Pango.Alignment.CENTER)
        self.fill(color);self.ctx.move_to(x,y);PangoCairo.show_layout(self.ctx,l)
        return height
    def footprint(self,kind,x,y,w,h):
        if kind!='cover' and (y<TOP-.5 or y+h>BOTTOM+.5):raise RuntimeError(f'Desbordamiento {kind} en página {self.page}: {y} + {h}')
        self.bounds.append([self.page,kind,round(y,2),round(h,2)])
    def footer(self):
        if self.page==1:return
        self.ctx.set_line_width(.5);self.fill('line');self.ctx.move_to(M,H-38);self.ctx.line_to(W-M,H-38);self.ctx.stroke()
        self.text('SG-CICT  /  Construir para entender',M,H-28,CW-100,7.4,color='muted',spacing=0)
        self.text(str(self.page)+((' / '+str(self.total)) if self.total else ''),W-M-75,H-28,75,7.5,color='muted',spacing=0)
    def new_page(self,title=None):
        if self.page:self.footer();self.ctx.show_page()
        self.page+=1;self.y=TOP
        if title is not None:self.title=title
        self.rect(0,0,W,H,'white')
        if self.page>1:
            self.text('SG-CICT  ·  MANUAL DE CONSTRUCCIÓN',M,23,280,7.1,bold=True,color='green',spacing=0)
            short=self.title if len(self.title)<49 else self.title[:46]+'…'
            self.text(short,W-M-220,23,220,7.0,color='muted',spacing=0)
            self.rect(M,43,CW,.5,'line')
    def ensure(self,height):
        if height>BOTTOM-TOP:raise RuntimeError('Bloque mayor que una página: '+str(height))
        if self.y+height>BOTTOM:self.new_page()
    def anchor(self,name):
        self.positions[name]=self.page
        self.ctx.tag_begin(cairo.TAG_DEST,f"name='{name}' x={M} y={self.y}")
        self.ctx.tag_end(cairo.TAG_DEST)
    def link(self,anchor,x,y,w,h):
        self.ctx.tag_begin(cairo.TAG_LINK,f"dest='{anchor}' rect=[{x} {y} {w} {h}]")
        self.ctx.tag_end(cairo.TAG_LINK)
    def cover(self):
        self.new_page('')
        self.rect(0,0,W,H,'forest')
        self.rect(M,52,98,28,'green');self.text('SG-CICT',M+11,57,90,12,bold=True,color='white',spacing=0)
        self.text('MANUAL DE CONSTRUCCIÓN',M,143,CW,10,bold=True,color='lime')
        self.text('Construye\nSG-CICT\npor tu cuenta.',M,188,CW,47,bold=True,color='white',spacing=0)
        self.text('TypeScript · HTML · CSS · SQLite',M,390,CW,14,color='lime')
        self.text('De la carpeta vacía a la aplicación que funciona.\nExplicación archivo por archivo, decisiones, pruebas\ny código completo para consultar.',M,435,CW,12,color='white',spacing=6)
        # Diagrama vectorial original de cuatro etapas.
        for i,label in enumerate(['DATOS','REGLAS','WEB','PRUEBAS']):
            x=M+i*(CW+10)/4
            self.rect(x,575,113,64,'green')
            self.text('0'+str(i+1),x+12,585,90,11,color='lime')
            self.text(label,x+12,608,90,8,bold=True,color='white')
        self.text('EDICIÓN DE REFERENCIA · 24 NOVIEMBRE 2026',M,718,CW,8,bold=True,color='lime')
        self.text(str(len(TEXTS))+' archivos de texto de referencia · Índice enlazado\nFuentes verificables · Versión HTML y ZIP complementarios',M,745,CW,9,color='white',spacing=5)
    def toc(self):
        self.new_page('Índice')
        self.text('Índice de consulta',M,self.y,CW,25,bold=True);self.y+=45
        self.text('Los títulos y números enlazan con su capítulo. El anexo A conserva todos los archivos originales.',M,self.y,CW,9,color='muted');self.y+=40
        for item in ENTRIES:
            if self.y+23>BOTTOM:self.new_page('Índice · continuación');self.text('Índice · continuación',M,self.y,CW,18,bold=True);self.y+=40
            title=item['number']+'  '+item['title']
            page=self.known.get(item['anchor'],'—')
            self.text(title,M,self.y,CW-40,8.4,color='muted' if item.get('appendix') else 'ink',spacing=0)
            self.text(str(page),W-M-32,self.y,32,8.4,bold=True,color='green',spacing=0)
            self.link(item['anchor'],M,self.y,CW,18)
            self.y+=21
    def chapter(self,b):
        self.new_page(b['title']);self.anchor(b['anchor'])
        flags=cairo.PDFOutlineFlags(0)
        self.surface.add_outline(cairo.PDF_OUTLINE_ROOT,b['number']+' · '+b['title'],f"dest='{b['anchor']}'",flags)
        self.text(('ANEXO '+b['number'] if b.get('appendix') else 'CAPÍTULO '+b['number']),M,self.y,CW,8.5,bold=True,color='green');self.y+=23
        titleheight=self.text(b['title'],M,self.y,CW,23 if not b.get('appendix') else 19,bold=True,spacing=3);self.y+=titleheight+13
        if b.get('subtitle'):
            hh=self.text(b['subtitle'],M,self.y,CW,10.2,color='muted');self.y+=hh+17
        self.rect(M,self.y,CW,1,'line');self.y+=19
    def paragraph(self,text):
        l,hh=self.layout(text)
        self.ensure(hh+10);self.footprint('p',M,self.y,CW,hh)
        self.fill('ink');self.ctx.move_to(M,self.y);PangoCairo.show_layout(self.ctx,l);self.y+=hh+10
    def heading(self,text):
        _,hh=self.layout(text,size=13,bold=True,spacing=1)
        self.ensure(hh+58);self.y+=11
        self.footprint('h',M,self.y,CW,hh)
        self.text(text,M,self.y,CW,13,bold=True,color='forest',spacing=1);self.y+=hh+10
    def callout(self,title,text):
        _,a=self.layout(title,CW-30,10.3,True);_,b=self.layout(text,CW-30,9.6)
        hh=a+b+31;self.ensure(hh+12);self.footprint('callout',M,self.y,CW,hh)
        self.rect(M,self.y,CW,hh,'paper');self.rect(M,self.y,3,hh,'green')
        self.text(title,M+15,self.y+11,CW-30,10.3,bold=True,color='forest')
        self.text(text,M+15,self.y+17+a,CW-30,9.6)
        self.y+=hh+13
    def listing(self,items,ordered=False):
        for i,text in enumerate(items,1):
            _,hh=self.layout(text,CW-24,9.9)
            self.ensure(hh+8);self.footprint('list',M,self.y,CW,hh)
            self.text(str(i)+'.' if ordered else '•',M,self.y,20,9.5,bold=True,color='green')
            self.text(text,M+24,self.y,CW-24,9.9);self.y+=hh+8
        self.y+=3
    def table(self,b):
        columns=b.get('widths') or ([.29,.71] if len(b['headers'])==2 else [.2]+[.8/(len(b['headers'])-1)]*(len(b['headers'])-1))
        widths=[v*CW for v in columns]
        def row(cells,header=False,index=0):
            heights=[self.layout(str(c),widths[i]-16,8.4 if not header else 8.0,header,spacing=2)[1] for i,c in enumerate(cells)]
            hh=max(heights)+17
            self.ensure(hh)
            self.rect(M,self.y,CW,hh,'forest' if header else ('paper' if index%2==0 else 'white'))
            x=M
            for i,c in enumerate(cells):
                self.text(str(c),x+8,self.y+8,widths[i]-16,8 if header else 8.4,bold=header,color='white' if header else 'ink',spacing=2);x+=widths[i]
            self.footprint('table',M,self.y,CW,hh);self.y+=hh
        self.ensure(70);row(b['headers'],True)
        for i,cells in enumerate(b['rows']):
            actual=max(self.layout(str(c),widths[j]-16,8.4,spacing=2)[1] for j,c in enumerate(cells))+17
            if self.y+actual>BOTTOM:self.new_page();row(b['headers'],True)
            row(cells,index=i)
        self.y+=14
    def token_markup(self,text,language):
        out=[]
        for token,value in lex(text,lexer_for(language)):
            if value.endswith('\n'):value=value[:-1]
            color='233f37'
            if token in Token.Comment:color='7a887d'
            elif token in Token.Keyword:color='69518b'
            elif token in Token.Literal.String:color='39764e'
            elif token in Token.Literal.Number:color='9b603f'
            elif token in Token.Name.Function:color='326c88'
            elif token in Token.Operator:color='8a5961'
            out.append('<span foreground="#'+color+'">'+html.escape(value,quote=False)+'</span>')
        return ''.join(out)
    def code(self,b):
        label=b.get('label','Código');self.ensure(50)
        self.text(label,M,self.y,CW,8.0,bold=True,color='green',mono=False,spacing=0);self.y+=18
        start=b.get('start',1);language=b.get('language','text');gutter=32;size=7.5;lineheight=10.3
        cap=88
        for n,line in enumerate(b['text'].split('\n'),start):
            expanded=line.replace('\t','    ')
            chunks=textwrap.wrap(expanded,width=cap,replace_whitespace=False,drop_whitespace=False,break_on_hyphens=False) or ['']
            if ''.join(chunks)!=expanded:raise RuntimeError('Pérdida de contenido al partir una línea: '+label)
            self.code_checks.append([label,n,len(line),len(chunks)])
            for j,chunk in enumerate(chunks):
                if self.y+lineheight>BOTTOM:
                    self.new_page();self.text(label+' · continúa',M,self.y,CW,8,bold=True,color='green',spacing=0);self.y+=19
                self.rect(M,self.y,CW,lineheight,'paper')
                self.text(str(n) if j==0 else '↳',M+5,self.y+.5,25,6.5,color='muted',mono=True,spacing=0)
                markup=self.token_markup(chunk,language)
                lay,hh=self.layout(markup,CW-gutter-8,size,mono=True,markup=True,spacing=0)
                # Una fila física debe caber: ningún token se recorta ni se oculta.
                if lay.get_line_count()>1:raise RuntimeError('Línea de código demasiado ancha: '+label+' '+str(n))
                self.footprint('code',M,self.y,CW,lineheight)
                self.fill('ink');self.ctx.move_to(M+gutter,self.y+.5);PangoCairo.show_layout(self.ctx,lay)
                self.y+=lineheight
        self.y+=15
    def image(self,b):
        surf=cairo.ImageSurface.create_from_png(str(ROOT/b['path']))
        scale=min(CW/surf.get_width(),b.get('height',260)/surf.get_height())
        ww,hh=surf.get_width()*scale,surf.get_height()*scale
        _,cap=self.layout(b['caption'],CW,8.3,color='muted')
        self.ensure(hh+cap+27);x=M+(CW-ww)/2
        self.ctx.save();self.ctx.translate(x,self.y);self.ctx.scale(scale,scale);self.ctx.set_source_surface(surf,0,0);self.ctx.paint();self.ctx.restore()
        self.footprint('image',x,self.y,ww,hh);self.y+=hh+8
        self.text(b['caption'],M,self.y,CW,8.3,color='muted');self.y+=cap+17
    def diagram(self,b):
        self.ensure(120);self.text(b['title'],M,self.y,CW,10.4,bold=True,color='forest');self.y+=28
        gap=13;ww=(CW-gap*(len(b['boxes'])-1))/len(b['boxes'])
        for i,text in enumerate(b['boxes']):
            x=M+i*(ww+gap);self.rect(x,self.y,ww,62,'paper');self.text(text,x+7,self.y+12,ww-14,8.7,bold=True,color='green',center=True)
            if i<len(b['boxes'])-1:self.text('→',x+ww+1,self.y+20,gap,9,color='green')
        self.y+=82
    def run(self):
        self.cover();self.toc()
        for b in BLOCKS+APPENDIX:
            k=b['kind']
            if k=='chapter':self.chapter(b)
            elif k=='heading':self.heading(b['text'])
            elif k=='paragraph':self.paragraph(b['text'])
            elif k=='callout':self.callout(b['title'],b['text'])
            elif k=='list':self.listing(b['items'],b.get('ordered',False))
            elif k=='table':self.table(b)
            elif k=='code':self.code(b)
            elif k=='image':self.image(b)
            elif k=='diagram':self.diagram(b)
            else:raise ValueError(k)
        self.footer();self.ctx.show_page();self.surface.finish()
        return self.page

def make_html(path):
    styles='''body{margin:0;background:#f4f7f1;color:#233f37;font:16px/1.75 system-ui,sans-serif}main{max-width:1040px;margin:auto;padding:40px 28px;background:white}h1{font-size:35px;line-height:1.2;margin-top:65px;border-bottom:2px solid #d4edbd;padding-bottom:20px}h2{font-size:24px;margin-top:35px}p{max-width:82ch}a{color:#3e7254}nav{padding:25px;background:#eff5eb;columns:2}nav a{display:block;font-size:13px;margin:6px 0;break-inside:avoid}.callout{padding:18px 24px;background:#f1f6ed;border-left:4px solid #4c785a;margin:20px 0}.code-title{font:12px monospace;color:#4c785a;margin-top:24px}pre{padding:20px;background:#f3f7f1;overflow:auto;font:12px/1.6 'DejaVu Sans Mono',monospace;tab-size:4}table{border-collapse:collapse;width:100%;font-size:13px;margin:20px 0}th{background:#173f3a;color:#fff}td,th{text-align:left;border:1px solid #dde6dd;padding:11px 14px;vertical-align:top}tr:nth-child(even){background:#f3f7f1}figure{margin:25px 0;text-align:center}img{max-width:100%;max-height:480px}figcaption{font-size:13px;color:#65766c}.diagram{display:flex;gap:15px}.diagram span{padding:18px;background:#eff5eb;flex:1;text-align:center}.cover{padding:55px;background:#173f3a;color:white}.cover h1{margin:0;color:white;border:0}.cover p{color:#d4edbd}.back{font-size:12px}.highlight{background:#f3f7f1}@media(max-width:700px){nav{columns:1}main{padding:25px 18px}.diagram{flex-direction:column}}@media print{body{background:white}main{max-width:none;padding:0}h1{break-before:page}pre{white-space:pre-wrap;overflow-wrap:anywhere}.back{display:none}@page{size:A4;margin:20mm}}'''
    formatter=HtmlFormatter(nowrap=True)
    output=['<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SG-CICT · Manual completo de construcción</title><style>'+styles+formatter.get_style_defs('.highlight')+'</style><main id="indice"><section class="cover"><p>MANUAL DE CONSTRUCCIÓN · TypeScript, HTML, CSS y SQLite</p><h1>Construye SG-CICT por tu cuenta</h1><p>Explicación por archivo y código completo de referencia.</p></section><h2>Índice enlazado</h2><nav>']
    for b in ENTRIES:output.append('<a href="#'+b['anchor']+'">'+html.escape(b['number']+' · '+b['title'])+'</a>')
    output.append('</nav>')
    for b in BLOCKS+APPENDIX:
        k=b['kind'];esc=html.escape
        if k=='chapter':output.append('<h1 id="'+b['anchor']+'">'+esc(b['number']+' · '+b['title'])+'</h1><p>'+esc(b.get('subtitle',''))+'</p><a class="back" href="#indice">Volver al índice</a>')
        elif k=='heading':output.append('<h2>'+esc(b['text'])+'</h2>')
        elif k=='paragraph':output.append('<p>'+esc(b['text'])+'</p>')
        elif k=='callout':output.append('<aside class="callout"><strong>'+esc(b['title'])+'</strong><p>'+esc(b['text'])+'</p></aside>')
        elif k=='list':
            tag='ol' if b.get('ordered') else 'ul';output.append('<'+tag+'>'+''.join('<li>'+esc(t)+'</li>' for t in b['items'])+'</'+tag+'>')
        elif k=='table':output.append('<table><thead><tr>'+''.join('<th>'+esc(str(c))+'</th>' for c in b['headers'])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+esc(str(c))+'</td>' for c in row)+'</tr>' for row in b['rows'])+'</tbody></table>')
        elif k=='code':output.append('<div class="code-title">'+esc(b.get('label','Código'))+'</div><pre class="highlight"><code>'+highlight(b['text'],lexer_for(b.get('language','text')),formatter)+'</code></pre>')
        elif k=='image':output.append('<figure><img src="../'+esc(b['path'],quote=True)+'" alt="'+esc(b['caption'],quote=True)+'"><figcaption>'+esc(b['caption'])+'</figcaption></figure>')
        elif k=='diagram':output.append('<h3>'+esc(b['title'])+'</h3><div class="diagram">'+''.join('<span>'+esc(t).replace('\n','<br>')+'</span>' for t in b['boxes'])+'</div>')
    output.append('</main></html>');path.write_text('\n'.join(output))

if __name__=='__main__':
    draft=HERE/(BASE+'_paginacion.pdf')
    first=Book(draft);pages=first.run()
    final=Book(HERE/(BASE+'.pdf'),pages,first.positions);actual=final.run()
    if actual!=pages:raise RuntimeError('La paginación cambió entre pasadas')
    draft.unlink()
    make_html(HERE/(BASE+'.html'))
    archive=HERE/'SG-CICT_fuentes_de_referencia.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for file in FILES:z.write(file,'prototipo/'+str(file.relative_to(ROOT)))
    changed=[name for name,digest in HASHES.items() if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest]
    if changed:raise RuntimeError('Las fuentes cambiaron durante la generación: '+str(changed))
    manifest={'title':'SG-CICT · Manual completo de construcción','date':'2026-11-24','pages':pages,'chapters':len(CHAPTERS),'source_text_files':len(TEXTS),'assets':len(FILES)-len(TEXTS),'source_sha256':HASHES,'toc':[{'number':b['number'],'title':b['title'],'page':final.positions[b['anchor']]} for b in ENTRIES],'layout_blocks_checked':len(final.bounds),'physical_code_rows':sum(v[3] for v in final.code_checks),'full_source_files':[b['full_source'] for b in APPENDIX if b['kind']=='code']}
    (HERE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({key:manifest[key] for key in ['pages','chapters','source_text_files','assets','layout_blocks_checked','physical_code_rows']},ensure_ascii=False))
